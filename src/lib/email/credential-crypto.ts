import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

function encryptionKey() {
  const value = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error(
      'EMAIL_CREDENTIALS_ENCRYPTION_KEY is not configured.',
    );
  }

  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64url');
  if (key.length !== 32) {
    throw new Error(
      'EMAIL_CREDENTIALS_ENCRYPTION_KEY must contain exactly 32 random bytes.',
    );
  }
  return key;
}

function additionalData(organizationId: string) {
  return Buffer.from('muna:company-email:' + organizationId, 'utf8');
}

export function encryptEmailCredential(
  plaintext: string,
  organizationId: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(additionalData(organizationId));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptEmailCredential(
  encrypted: string,
  organizationId: string,
) {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split('.');
  if (
    version !== VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue
  ) {
    throw new Error('The saved email credential has an unsupported format.');
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      encryptionKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAAD(additionalData(organizationId));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error(
      'Muna could not decrypt the saved email credential. Restore the original encryption key or reconnect the mailbox.',
    );
  }
}
