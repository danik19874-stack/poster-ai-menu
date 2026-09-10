import type { CreateOrderRequest, CreateOrderResponse } from './types';
import { PosterApiError } from './types';

const POSTER_BASE_URL = 'https://joinposter.com/api';

export async function createOrder(
  token: string,
  order: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  let response: Response;
  try {
    response = await fetch(`${POSTER_BASE_URL}/orders?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
  } catch (err) {
    // fetch itself threw (DNS failure, connection reset, timeout, ...) — Poster was never
    // reached, so there is no HTTP status. Use 0 as a sentinel so callers can tell this apart
    // from a real 4xx/5xx response from Poster.
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster API: ${message}`, 0);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new PosterApiError(
      body?.error?.message ?? `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const body = await response.json();
  if (typeof body?.response?.id !== 'number') {
    // Poster responded 2xx but the payload doesn't match the shape we rely on. Reuse the
    // real (ok) HTTP status here since Poster did successfully respond — this is a contract
    // mismatch, not a transport or rejection error, so it shouldn't be confused with either.
    throw new PosterApiError('Poster returned an unexpected order response shape', response.status);
  }

  return body as CreateOrderResponse;
}
