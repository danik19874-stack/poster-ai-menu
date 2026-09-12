import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const FORMAT_VERSION = 'v1';

function getKey(): Buffer {
  const encoded = process.env.SECRETS_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error('Missing required environment variable: SECRETS_ENCRYPTION_KEY');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error('SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)');
  }
  return key;
}

/**
 * Encrypts a plaintext secret (e.g. a Poster/Gemini API token) for storage at rest.
 * Output format: "v1:<iv>:<authTag>:<ciphertext>", each segment base64.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error('Malformed secretBox payload');
  }
  const [, ivB64, authTagB64, ciphertextB64] = parts;

  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
