/** Encryption for provider credentials stored outside the Worker's secret bindings. */
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VERSION = "v1";

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function keyFromSecret(secret: string | undefined): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = decode(secret ?? "");
  } catch {
    throw new Error("EMAIL_CREDENTIAL_KEY must be a base64-encoded 32-byte key");
  }
  if (raw.byteLength !== 32 || encode(raw) !== secret) {
    throw new Error("EMAIL_CREDENTIAL_KEY must be a base64-encoded 32-byte key");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Bind ciphertext to its purpose so that two credential fields cannot be swapped. */
export async function encryptCredential(
  secret: string | undefined,
  purpose: string,
  value: string,
): Promise<string> {
  const key = await keyFromSecret(secret);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: encoder.encode(purpose) },
    key,
    encoder.encode(value),
  );
  return `${VERSION}.${encode(nonce)}.${encode(new Uint8Array(ciphertext))}`;
}

export async function decryptCredential(
  secret: string | undefined,
  purpose: string,
  stored: string,
): Promise<string> {
  const key = await keyFromSecret(secret);
  try {
    const parts = stored.split(".");
    if (parts.length !== 3 || parts[0] !== VERSION || !parts[1] || !parts[2]) {
      throw new Error();
    }
    const nonce = decode(parts[1]);
    if (nonce.byteLength !== 12) {
      throw new Error();
    }
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: encoder.encode(purpose) },
      key,
      decode(parts[2]),
    );
    return decoder.decode(plaintext);
  } catch {
    // Do not include the ciphertext or the underlying exception in a response or log.
    throw new Error("Unable to decrypt email credential");
  }
}
