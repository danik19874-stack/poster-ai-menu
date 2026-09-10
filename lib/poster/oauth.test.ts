import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { exchangeOAuthCode, getSpots } from './oauth';
import { PosterApiError } from './types';

describe('exchangeOAuthCode', () => {
  beforeEach(() => {
    vi.stubEnv('POSTER_APPLICATION_ID', '5313');
    vi.stubEnv('POSTER_APPLICATION_SECRET', 'test-secret');
    vi.stubEnv('POSTER_OAUTH_REDIRECT_URI', 'http://localhost:3000/api/oauth/callback');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts form-data with application_id/secret/grant_type/redirect_uri/code and maps the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: '687409:abc123', account_number: '687409' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exchangeOAuthCode('mycafe', 'the-code');

    expect(result).toEqual({ accessToken: '687409:abc123', accountNumber: '687409' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mycafe.joinposter.com/api/v2/auth/access_token');
    expect(options.method).toBe('POST');
    const body = options.body as URLSearchParams;
    expect(body.get('application_id')).toBe('5313');
    expect(body.get('application_secret')).toBe('test-secret');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('redirect_uri')).toBe('http://localhost:3000/api/oauth/callback');
    expect(body.get('code')).toBe('the-code');
  });

  it('throws a clear error if required env vars are missing', async () => {
    vi.stubEnv('POSTER_APPLICATION_SECRET', '');

    await expect(exchangeOAuthCode('mycafe', 'the-code')).rejects.toThrow(
      'POSTER_APPLICATION_SECRET',
    );
  });

  it('throws PosterApiError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error_message: 'Invalid code' }),
      }),
    );

    await expect(exchangeOAuthCode('mycafe', 'bad-code')).rejects.toThrow(PosterApiError);
  });

  it('throws PosterApiError when the response is missing access_token or account_number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ account_number: '687409' }) }),
    );

    await expect(exchangeOAuthCode('mycafe', 'the-code')).rejects.toThrow(PosterApiError);
  });

  it('wraps a network failure in PosterApiError with statusCode 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(exchangeOAuthCode('mycafe', 'the-code')).rejects.toMatchObject({
      statusCode: 0,
    });
  });
});

describe('getSpots', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps spot_id/name/address, coercing a stringly-typed spot_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            { spot_id: '1', name: 'Кафе на Полянке', address: 'Киев, ул. Б.Полянка 44' },
            { spot_id: 2, name: 'Вторая точка', address: 'Алматы' },
          ],
        }),
      }),
    );

    const spots = await getSpots('687409:abc123');

    expect(spots).toEqual([
      { spotId: 1, name: 'Кафе на Полянке', address: 'Киев, ул. Б.Полянка 44' },
      { spotId: 2, name: 'Вторая точка', address: 'Алматы' },
    ]);
  });

  it('throws PosterApiError when the response is not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    await expect(getSpots('tok')).rejects.toThrow(PosterApiError);
  });

  it('throws PosterApiError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    await expect(getSpots('bad-token')).rejects.toThrow(PosterApiError);
  });

  it('wraps a network failure in PosterApiError with statusCode 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(getSpots('tok')).rejects.toMatchObject({ statusCode: 0 });
  });
});
