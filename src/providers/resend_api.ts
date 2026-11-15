import { substituteRecipient } from "../render/render";
import {
  PROVIDER_REQUEST_TIMEOUT_MS,
  type Recipient,
  type RenderedEmail,
  type SendBatchResult,
} from "./types";

/** Submit a single Resend batch. An exception means acceptance cannot be established. */
export async function sendResendBatch(
  apiKey: string,
  from: string,
  rendered: RenderedEmail,
  recipients: Recipient[],
  batchKey?: string,
): Promise<SendBatchResult> {
  if (recipients.length === 0 || recipients.length > 100) {
    throw new Error("Resend batches must contain between 1 and 100 recipients");
  }
  const messages = recipients.map((recipient) => {
    const content = substituteRecipient(rendered, {
      ".Email.UnsubscribeURL": recipient.unsubscribeUrl,
      ".Email.SentTo": recipient.email,
    });
    return {
      from,
      to: [recipient.email],
      ...content,
      ...(recipient.unsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${recipient.unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    };
  });
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (batchKey) {
    headers["Idempotency-Key"] = batchKey;
  }
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Resend did not answer; acceptance is unknown");
  }
  // A server error or conflict may follow a submission; never claim it was refused.
  if (response.status >= 500 || response.status === 409) {
    throw new Error("Resend could not confirm whether the batch was accepted");
  }
  if (!response.ok) {
    const status = response.status;
    const body = (await response.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name : "";
    const cause =
      status === 429
        ? name === "daily_quota_exceeded" || name === "monthly_quota_exceeded"
          ? "quota"
          : "rate_limit"
        : status === 401
          ? "credentials"
          : status === 403
            ? "sender"
            : "invalid_request";
    return {
      kind: "halted",
      halt: {
        reason: status === 429 ? "unavailable" : "account",
        cause,
        // Provider response text may contain credentials or recipient data.
        error: `Resend refused the batch (HTTP ${status}).`,
      },
    };
  }
  const result = (await response.json().catch(() => null)) as { data?: unknown } | null;
  if (
    !Array.isArray(result?.data) ||
    result.data.length !== recipients.length ||
    !result.data.every((item: unknown) =>
      Boolean(
        item && typeof item === "object" && "id" in item && typeof item.id === "string" && item.id,
      ),
    )
  ) {
    throw new Error("Resend returned an incomplete answer; acceptance is unknown");
  }
  return {
    kind: "answered",
    results: recipients.map((recipient, index) => ({
      email: recipient.email,
      accepted: true,
      providerId: (result.data as { id: string }[])[index]?.id ?? "",
    })),
  };
}
