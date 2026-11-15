import type { DeliveryEvent } from "./types";

/** Verify a Resend/Svix signature over the exact raw body, before parsing it. */
export async function verifyResendWebhook(
  request: Request,
  secret: string,
  now = Date.now(),
): Promise<{ id: string; events: DeliveryEvent[] } | null> {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signatures = request.headers.get("svix-signature");
  if (
    !id ||
    !timestamp ||
    !signatures ||
    !/^\d+$/.test(timestamp) ||
    !secret.startsWith("whsec_")
  ) {
    return null;
  }
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(now / 1000 - seconds) > 300) {
    return null;
  }
  const body = await request.text();
  try {
    const keyBytes = Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0));
    if (!keyBytes.length) {
      return null;
    }
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
    let verified = false;
    for (const candidate of signatures.split(" ")) {
      const [version, value] = candidate.split(",");
      if (version !== "v1" || !value) {
        continue;
      }
      try {
        const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
        if (await crypto.subtle.verify("HMAC", key, bytes, signed)) {
          verified = true;
        }
      } catch {
        // Another signature in the header may still verify during key rotation.
      }
    }
    if (!verified) {
      return null;
    }
    const payload: unknown = JSON.parse(body);
    return { id, events: normalizeResendEvent(payload) };
  } catch {
    return null;
  }
}

function normalizeResendEvent(payload: unknown): DeliveryEvent[] {
  if (!payload || typeof payload !== "object" || !("type" in payload) || !("data" in payload)) {
    return [];
  }
  const { type, data } = payload;
  if (
    !data ||
    typeof data !== "object" ||
    !("email_id" in data) ||
    typeof data.email_id !== "string"
  ) {
    return [];
  }
  const address =
    "to" in data && Array.isArray(data.to) && typeof data.to[0] === "string"
      ? data.to[0]
      : undefined;
  const base = { providerId: data.email_id, email: address };
  if (type === "email.delivered") {
    return [{ ...base, type: "delivered" }];
  }
  if (type === "email.complained") {
    return [{ ...base, type: "complained" }];
  }
  if (type === "email.bounced") {
    const bounce =
      "bounce" in data && data.bounce && typeof data.bounce === "object" ? data.bounce : null;
    const hard = bounce !== null && "type" in bounce && bounce.type === "Permanent";
    return [{ ...base, type: "bounced", hard }];
  }
  return [];
}
