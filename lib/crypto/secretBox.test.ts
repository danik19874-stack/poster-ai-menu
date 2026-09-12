import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import { encrypt, decrypt } from './secretBox';

const ORIGINAL_KEY = process.env.SECRETS_ENCRYPTION_KEY;

function setValidKey() {
  process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
}

describe('secretBox', () => {
  beforeEach(() => {
    setValidKey();
  });

  afterEach(() => {
    process.env.SECRETS_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it('round-trips a plaintext string', () => {
    const ciphertext = encrypt('super-secret-poster-token');
    expect(decrypt(ciphertext)).toBe('super-secret-poster-token');
  });

  it('round-trips an empty string', () => {
    const ciphertext = encrypt('');
    expect(decrypt(ciphertext)).toBe('');
  });

  it('produces different ciphertext for the same plaintext each call (random IV)', () => {
    const a = encrypt('same-value');
    const b = encrypt('same-value');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same-value');
    expect(decrypt(b)).toBe('same-value');
  });

  it('throws when ciphertext has been tampered with', () => {
    const ciphertext = encrypt('do-not-touch');
    const parts = ciphertext.split(':');
    // Flip the last character of the ciphertext segment to corrupt it.
    const lastPart = parts[3];
    const corrupted = lastPart.slice(0, -1) + (lastPart.endsWith('A') ? 'B' : 'A');
    parts[3] = corrupted;
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws on a malformed payload', () => {
    expect(() => decrypt('not-a-valid-payload')).toThrow();
  });

  it('throws when SECRETS_ENCRYPTION_KEY is missing', () => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
    expect(() => encrypt('value')).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });

  it('throws when SECRETS_ENCRYPTION_KEY is not 32 bytes', () => {
    process.env.SECRETS_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
    expect(() => encrypt('value')).toThrow(/32 bytes/);
  });
});
