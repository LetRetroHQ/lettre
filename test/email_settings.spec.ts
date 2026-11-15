import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, expect, it } from "vitest";
import { resetDatabase } from "./support/fixtures";
import { AUTH, base, JSON_AUTH } from "./support/http";

beforeEach(resetDatabase);

it("requires authentication and stores credentials without returning them", async () => {
  expect((await SELF.fetch(`${base}/api/settings/email`)).status).toBe(401);
  const saved = await SELF.fetch(`${base}/api/settings/email`, {
    method: "PUT",
    headers: JSON_AUTH,
    body: JSON.stringify({ api_key: "re_example", webhook_secret: "whsec_example" }),
  });
  expect(saved.status).toBe(200);
  const body = await saved.text();
  expect(body).not.toContain("re_example");
  expect(body).not.toContain("whsec_example");
  expect(JSON.parse(body).resend).toEqual({ api_key_set: true, webhook_secret_set: true });
  const rows = await env.DB.prepare("SELECT ciphertext FROM email_credentials").all<{
    ciphertext: string;
  }>();
  expect(JSON.stringify(rows)).not.toContain("example");
  const read = await SELF.fetch(`${base}/api/settings/email`, { headers: AUTH });
  expect(read.headers.get("cache-control")).toContain("no-store");
});

it("rejects foreign writes and invalid credentials", async () => {
  const foreign = await SELF.fetch(`${base}/api/settings/email`, {
    method: "PUT",
    headers: { ...JSON_AUTH, Origin: "https://other.example" },
    body: JSON.stringify({ api_key: "re_example" }),
  });
  expect(foreign.status).toBe(403);
  const invalid = await SELF.fetch(`${base}/api/settings/email`, {
    method: "PUT",
    headers: JSON_AUTH,
    body: JSON.stringify({ api_key: "bad" }),
  });
  expect(invalid.status).toBe(400);
});
