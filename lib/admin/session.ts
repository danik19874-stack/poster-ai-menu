import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('Missing required environment variable: ADMIN_PASSWORD');
  }
  return password;
}

function sign(payload: string): string {
  return createHmac('sha256', getPassword()).update(payload).digest('hex');
}

export function checkPassword(candidate: string): boolean {
  return candidate === getPassword();
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  return `${expiresAt}.${sign(String(expiresAt))}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const [expiresAtStr, signature] = token.split('.');
  if (!expiresAtStr || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = sign(expiresAtStr);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;

  return timingSafeEqual(provided, expectedBuf);
}
