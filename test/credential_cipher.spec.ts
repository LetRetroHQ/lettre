import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  hasEmailCredential,
  readEmailCredential,
  saveEmailCredential,
} from "../src/db/email_credentials";
import { decryptCredential, encryptCredential } from "../src/lib/credential_cipher";

const key = btoa("a".repeat(32));
const otherKey = btoa("b".repeat(32));

describe("email credential encryption", () => {
  it("round trips without storing plaintext and uses a fresh nonce", async () => {
    const first = await encryptCredential(key, "resend/api-key", "re_example-secret");
    const second = await encryptCredential(key, "resend/api-key", "re_example-secret");
    expect(first).not.toContain("re_example-secret");
    expect(first).not.toBe(second);
    expect(await decryptCredential(key, "resend/api-key", first)).toBe("re_example-secret");
  });

  it("rejects missing and malformed keys", async () => {
    for (const invalid of [undefined, "", "not-base64", btoa("short")]) {
      await expect(encryptCredential(invalid, "resend/api-key", "secret")).rejects.toThrow(
        "EMAIL_CREDENTIAL_KEY",
      );
    }
  });

  it("rejects changed ciphertext, wrong keys and swapped credential fields", async () => {
    const stored = await encryptCredential(key, "resend/api-key", "secret");
    const parts = stored.split(".");
    const ciphertext = atob(parts[2] ?? "");
    const altered = `${parts[0]}.${parts[1]}.${btoa(String.fromCharCode(ciphertext.charCodeAt(0) ^ 1) + ciphertext.slice(1))}`;
    for (const attempt of [
      decryptCredential(key, "resend/api-key", altered),
      decryptCredential(otherKey, "resend/api-key", stored),
      decryptCredential(key, "resend/webhook", stored),
      decryptCredential(key, "resend/api-key", "invalid"),
    ]) {
      await expect(attempt).rejects.toThrow("Unable to decrypt email credential");
    }
  });
});

it("stores only ciphertext and supports replacing a credential", async () => {
  await env.DB.prepare("DELETE FROM email_credentials WHERE provider = ?")
    .bind("cipher-test")
    .run();
  expect(await hasEmailCredential(env.DB, "cipher-test", "api_key")).toBe(false);
  await saveEmailCredential(env.DB, key, "cipher-test", "api_key", "re_original-secret");
  const row = await env.DB.prepare("SELECT ciphertext FROM email_credentials WHERE provider = ?")
    .bind("cipher-test")
    .first<{ ciphertext: string }>();
  expect(row?.ciphertext).not.toContain("re_original-secret");
  expect(await readEmailCredential(env.DB, key, "cipher-test", "api_key")).toBe(
    "re_original-secret",
  );
  await saveEmailCredential(env.DB, key, "cipher-test", "api_key", "re_replacement");
  expect(await readEmailCredential(env.DB, key, "cipher-test", "api_key")).toBe("re_replacement");
  await expect(readEmailCredential(env.DB, otherKey, "cipher-test", "api_key")).rejects.toThrow();
});
