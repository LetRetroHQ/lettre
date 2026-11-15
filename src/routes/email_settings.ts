import { hasEmailCredential, saveEmailCredentials } from "../db/email_credentials";
import { optString, readJsonObject } from "../lib/body";
import { badRequest, json } from "../lib/errors";
import type { RequestContext } from "../router";

export async function get(c: RequestContext): Promise<Response> {
  const [apiKey, webhookSecret] = await Promise.all([
    hasEmailCredential(c.env.DB, "resend", "api_key"),
    hasEmailCredential(c.env.DB, "resend", "webhook_secret"),
  ]);
  return json(
    {
      active_provider: c.config.provider,
      resend: { api_key_set: apiKey, webhook_secret_set: webhookSecret },
    },
    200,
    { "Cache-Control": "no-store" },
  );
}

export async function put(c: RequestContext): Promise<Response> {
  const body = await readJsonObject(c);
  const apiKey = optString(body, "api_key");
  const webhookSecret = optString(body, "webhook_secret");
  if (apiKey === undefined && webhookSecret === undefined) {
    throw badRequest("Provide a credential to save.");
  }
  if (
    apiKey !== undefined &&
    (!apiKey.startsWith("re_") || apiKey.length > 512 || /\s/.test(apiKey))
  ) {
    throw badRequest("Enter a valid Resend API key.");
  }
  if (
    webhookSecret !== undefined &&
    (!webhookSecret.startsWith("whsec_") || webhookSecret.length > 512 || /\s/.test(webhookSecret))
  ) {
    throw badRequest("Enter a valid Resend webhook signing secret.");
  }
  await saveEmailCredentials(c.env.DB, c.env.EMAIL_CREDENTIAL_KEY, "resend", {
    ...(apiKey === undefined ? {} : { api_key: apiKey }),
    ...(webhookSecret === undefined ? {} : { webhook_secret: webhookSecret }),
  });
  return get(c);
}
