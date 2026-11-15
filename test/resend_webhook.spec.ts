import { describe, expect, it } from "vitest";
import { verifyResendWebhook } from "../src/providers/resend_webhook";

const secretBytes = new TextEncoder().encode("a test signing secret");
const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
const now = 1_700_000_000_000;
const body = JSON.stringify({
  type: "email.bounced",
  data: { email_id: "id", to: ["a@example.com"], bounce: { type: "Permanent" } },
});

async function signedRequest(payload = body, timestamp = String(now / 1000)): Promise<Request> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`event-id.${timestamp}.${body}`),
    ),
  );
  return new Request("https://example.com/webhooks/resend", {
    method: "POST",
    body: payload,
    headers: {
      "svix-id": "event-id",
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${btoa(String.fromCharCode(...signature))}`,
    },
  });
}

describe("Resend webhook signature", () => {
  it("verifies the raw payload and normalizes a permanent bounce", async () => {
    expect(await verifyResendWebhook(await signedRequest(), secret, now)).toEqual({
      id: "event-id",
      events: [{ type: "bounced", providerId: "id", email: "a@example.com", hard: true }],
    });
  });
  it("rejects changed bodies, wrong keys and expired timestamps", async () => {
    expect(await verifyResendWebhook(await signedRequest(`${body} `), secret, now)).toBeNull();
    expect(
      await verifyResendWebhook(await signedRequest(), `whsec_${btoa("other")}`, now),
    ).toBeNull();
    expect(
      await verifyResendWebhook(await signedRequest(body, String(now / 1000 - 301)), secret, now),
    ).toBeNull();
  });
});
