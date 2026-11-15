import { decryptCredential, encryptCredential } from "../lib/credential_cipher";

export type EmailCredentialKind = "api_key" | "webhook_secret";

function purpose(provider: string, kind: EmailCredentialKind): string {
  return `lettre/email-credential/${provider}/${kind}`;
}

/** Persist only authenticated ciphertext. The key is held separately in a Worker secret. */
export async function saveEmailCredential(
  db: D1Database,
  key: string | undefined,
  provider: string,
  kind: EmailCredentialKind,
  value: string,
): Promise<void> {
  const ciphertext = await encryptCredential(key, purpose(provider, kind), value);
  await db
    .prepare(
      `INSERT INTO email_credentials (provider, kind, ciphertext, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (provider, kind) DO UPDATE SET ciphertext = excluded.ciphertext, updated_at = excluded.updated_at`,
    )
    .bind(provider, kind, ciphertext, Date.now())
    .run();
}

/** Encrypt all supplied values before committing them together. */
export async function saveEmailCredentials(
  db: D1Database,
  key: string | undefined,
  provider: string,
  values: Partial<Record<EmailCredentialKind, string>>,
): Promise<void> {
  const entries = Object.entries(values) as [EmailCredentialKind, string][];
  const encrypted = await Promise.all(
    entries.map(async ([kind, value]) => ({
      kind,
      ciphertext: await encryptCredential(key, purpose(provider, kind), value),
    })),
  );
  if (encrypted.length === 0) {
    return;
  }
  await db.batch(
    encrypted.map(({ kind, ciphertext }) =>
      db
        .prepare(
          `INSERT INTO email_credentials (provider, kind, ciphertext, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (provider, kind) DO UPDATE SET ciphertext = excluded.ciphertext, updated_at = excluded.updated_at`,
        )
        .bind(provider, kind, ciphertext, Date.now()),
    ),
  );
}

export async function readEmailCredential(
  db: D1Database,
  key: string | undefined,
  provider: string,
  kind: EmailCredentialKind,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT ciphertext FROM email_credentials WHERE provider = ? AND kind = ?")
    .bind(provider, kind)
    .first<{ ciphertext: string }>();
  return row ? decryptCredential(key, purpose(provider, kind), row.ciphertext) : null;
}

/** Presence is safe to show to an authenticated operator; ciphertext is not returned. */
export async function hasEmailCredential(
  db: D1Database,
  provider: string,
  kind: EmailCredentialKind,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS present FROM email_credentials WHERE provider = ? AND kind = ?")
    .bind(provider, kind)
    .first<{ present: number }>();
  return row !== null;
}
