-- Ciphertext only; the encryption key is a separate Worker secret.
CREATE TABLE email_credentials (
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, kind)
) STRICT;
