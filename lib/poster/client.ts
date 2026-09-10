import type {
  CreateIncomingOrderRequest,
  CreateIncomingOrderResult,
  PosterProduct,
} from './types';
import { PosterApiError } from './types';

const POSTER_BASE_URL = 'https://joinposter.com/api';

interface RawPosterProduct {
  product_id: string;
  product_name: string;
  description: string;
  price: Record<string, string>;
  ingredient_name: string[] | null;
  hidden: string;
}

export async function createIncomingOrder(
  token: string,
  order: CreateIncomingOrderRequest,
): Promise<CreateIncomingOrderResult> {
  const body = {
    spot_id: order.spotId,
    phone: order.phone,
    skip_phone_validation: order.skipPhoneValidation,
    service_mode: order.serviceMode,
    comment: order.comment,
    products: order.products.map((item) => ({
      product_id: item.productId,
      count: item.count,
      ...(item.modificatorId !== undefined ? { modificator_id: item.modificatorId } : {}),
    })),
  };

  let response: Response;
  try {
    response = await fetch(
      `${POSTER_BASE_URL}/incomingOrders.createIncomingOrder?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    // fetch itself threw (DNS failure, connection reset, timeout, ...) — Poster was never
    // reached, so there is no HTTP status. Use 0 as a sentinel so callers can tell this apart
    // from a real 4xx/5xx response from Poster.
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster API: ${message}`, 0);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new PosterApiError(
      errorBody?.error?.message ?? `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const parsed = await response.json();
  // TODO(Task 9 — live API verification): incomingOrders is an older-style Poster endpoint
  // like menu.getProducts, which is known to return numeric fields as strings (product_id,
  // hidden). incoming_order_id/status may do the same — coerce via Number() rather than a
  // strict typeof check, so a stringly-typed but otherwise-valid response doesn't make us
  // falsely report a real, successfully-placed order as failed.
  const incomingOrderId = Number(parsed?.response?.incoming_order_id);
  const status = Number(parsed?.response?.status);
  if (!Number.isFinite(incomingOrderId) || !Number.isFinite(status)) {
    // Poster responded 2xx but the payload doesn't match the shape we rely on. Reuse the
    // real (ok) HTTP status here since Poster did successfully respond — this is a contract
    // mismatch, not a transport or rejection error, so it shouldn't be confused with either.
    throw new PosterApiError(
      'Poster returned an unexpected incoming order response shape',
      response.status,
    );
  }

  return { incomingOrderId, status };
}

// TODO(Task 9 — live API verification): harden like createIncomingOrder (network-error wrapping,
// response-shape validation) once the real Poster response shape is confirmed.
export async function getProducts(token: string): Promise<PosterProduct[]> {
  const response = await fetch(`${POSTER_BASE_URL}/menu.getProducts?token=${token}`);

  if (!response.ok) {
    throw new PosterApiError(
      `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const { response: rawProducts } = (await response.json()) as {
    response: RawPosterProduct[];
  };

  return rawProducts.map((raw) => {
    // MVP assumption: one Poster spot per restaurant — picks the first (lowest spot id) price.
    // Revisit if a multi-spot account is ever onboarded.
    const price = Number(Object.values(raw.price)[0]) / 100;
    if (Number.isNaN(price)) {
      // Not a real HTTP response problem — this is a data-shape problem in an otherwise-ok
      // response, so there's no genuine status code. Reuse the same 0 sentinel createIncomingOrder
      // uses for its own "no real HTTP status applies" case, for consistency.
      throw new PosterApiError(`Product ${raw.product_id} has no price at any spot`, 0);
    }

    return {
      productId: Number(raw.product_id),
      name: raw.product_name,
      description: raw.description,
      price,
      ingredients: raw.ingredient_name ? raw.ingredient_name.map((name) => ({ name })) : null,
      inStopList: raw.hidden === '1',
    };
  });
}
