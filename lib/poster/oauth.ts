import { PosterApiError } from './types';

export interface PosterSpot {
  spotId: number;
  name: string;
  address: string;
}

export interface ExchangeOAuthCodeResult {
  accessToken: string;
  accountNumber: string;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Poster account subdomains are alphanumeric-with-hyphens (the "mycafe" in
// mycafe.joinposter.com). This route is reachable via a plain unauthenticated
// GET (see app/api/oauth/callback/route.ts), so `account` is untrusted input
// that gets interpolated straight into the fetch URL below — without this
// check, a value like "attacker.test/x" would send our
// POSTER_APPLICATION_SECRET to attacker.test instead of Poster.
const POSTER_ACCOUNT_FORMAT = /^[a-z0-9][a-z0-9-]{0,62}$/i;

export async function exchangeOAuthCode(
  account: string,
  code: string,
): Promise<ExchangeOAuthCodeResult> {
  if (!POSTER_ACCOUNT_FORMAT.test(account)) {
    throw new PosterApiError(`Invalid Poster account identifier: "${account}"`, 400);
  }

  const body = new URLSearchParams({
    application_id: requireEnv('POSTER_APPLICATION_ID'),
    application_secret: requireEnv('POSTER_APPLICATION_SECRET'),
    grant_type: 'authorization_code',
    redirect_uri: requireEnv('POSTER_OAUTH_REDIRECT_URI'),
    code,
  });

  let response: Response;
  try {
    response = await fetch(`https://${account}.joinposter.com/api/v2/auth/access_token`, {
      method: 'POST',
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster OAuth token endpoint: ${message}`, 0);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new PosterApiError(
      errorBody?.error_message ??
        `Poster OAuth token exchange failed with status ${response.status}`,
      response.status,
    );
  }

  const parsed = await response.json();
  const accessToken = parsed?.access_token;
  const accountNumber = parsed?.account_number;
  if (
    typeof accessToken !== 'string' ||
    !accessToken ||
    typeof accountNumber !== 'string' ||
    !accountNumber
  ) {
    throw new PosterApiError(
      'Poster OAuth token response missing access_token/account_number',
      response.status,
    );
  }

  return { accessToken, accountNumber };
}

export async function getSpots(token: string): Promise<PosterSpot[]> {
  let response: Response;
  try {
    response = await fetch(`https://joinposter.com/api/spots.getSpots?token=${token}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster spots.getSpots: ${message}`, 0);
  }

  if (!response.ok) {
    throw new PosterApiError(
      `Poster spots.getSpots failed with status ${response.status}`,
      response.status,
    );
  }

  const parsed = await response.json();
  const rawSpots = parsed?.response;
  if (!Array.isArray(rawSpots)) {
    throw new PosterApiError(
      'Poster spots.getSpots returned an unexpected response shape',
      response.status,
    );
  }

  return rawSpots.map((raw) => {
    const spotId = Number(raw?.spot_id);
    if (!Number.isFinite(spotId)) {
      throw new PosterApiError(
        'Poster spots.getSpots returned a spot with no valid spot_id',
        response.status,
      );
    }
    return {
      spotId,
      name: String(raw?.name ?? ''),
      address: String(raw?.address ?? ''),
    };
  });
}
