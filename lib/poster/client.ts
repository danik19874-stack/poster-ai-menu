import type { CreateOrderRequest, CreateOrderResponse } from './types';
import { PosterApiError } from './types';

const POSTER_BASE_URL = 'https://joinposter.com/api';

export async function createOrder(
  token: string,
  order: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  const response = await fetch(`${POSTER_BASE_URL}/orders?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new PosterApiError(
      body?.error?.message ?? `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  return response.json();
}
