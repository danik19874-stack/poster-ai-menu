import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPassword, createSessionToken, verifySessionToken } from './session';

describe('admin session', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', 'correct-horse-battery-staple');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('checkPassword', () => {
    it('accepts the correct password', () => {
      expect(checkPassword('correct-horse-battery-staple')).toBe(true);
    });

    it('rejects an incorrect password', () => {
      expect(checkPassword('wrong')).toBe(false);
    });

    it('rejects a candidate shorter than the real password without throwing', () => {
      expect(checkPassword('x')).toBe(false);
    });

    it('rejects a candidate longer than the real password without throwing', () => {
      expect(checkPassword('correct-horse-battery-staple-and-then-some-more')).toBe(false);
    });

    it('rejects an empty candidate', () => {
      expect(checkPassword('')).toBe(false);
    });
  });

  describe('createSessionToken / verifySessionToken', () => {
    it('verifies a freshly created token', () => {
      expect(verifySessionToken(createSessionToken())).toBe(true);
    });

    it('rejects a tampered signature', () => {
      const token = createSessionToken();
      const [expiresAt] = token.split('.');
      expect(verifySessionToken(`${expiresAt}.deadbeef`)).toBe(false);
    });

    it('rejects an expired token', () => {
      const expiredExpiresAt = Date.now() - 1000;
      const tokenWithPastExpiry = `${expiredExpiresAt}.anything`;
      expect(verifySessionToken(tokenWithPastExpiry)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(verifySessionToken(undefined)).toBe(false);
    });

    it('rejects a malformed token with no signature part', () => {
      expect(verifySessionToken('not-a-real-token')).toBe(false);
    });
  });
});
