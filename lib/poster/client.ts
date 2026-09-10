import type {
  CreateIncomingOrderRequest,
  CreateIncomingOrderResult,
  PosterIngredientRef,
  PosterProduct,
  PosterProductType,
} from './types';
import { PosterApiError } from './types';

const POSTER_BASE_URL = 'https://joinposter.com/api';

interface RawPosterProduct {
  product_id: string;
  product_name: string;
  price: Record<string, string>;
  type: string;
  hidden: string;
}

interface RawPosterIngredient {
  ingredient_name: string;
}

interface RawPosterProductDetail {
  ingredients?: RawPosterIngredient[];
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
  const incomingOrderId = Number(parsed?.response?.incoming_order_id);
  const status = Number(parsed?.response?.status);
  if (!Number.isFinite(incomingOrderId) || !Number.isFinite(status)) {
    throw new PosterApiError(
      'Poster returned an unexpected incoming order response shape',
      response.status,
    );
  }

  return { incomingOrderId, status };
}

export async function getProducts(token: string): Promise<PosterProduct[]> {
  let response: Response;
  try {
    response = await fetch(`${POSTER_BASE_URL}/menu.getProducts?token=${token}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster API: ${message}`, 0);
  }

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
      throw new PosterApiError(`Product ${raw.product_id} has no price at any spot`, 0);
    }

    const type = Number(raw.type) as PosterProductType;
    if (type !== 1 && type !== 2 && type !== 3) {
      throw new PosterApiError(
        `Product ${raw.product_id} has an unrecognized type: ${raw.type}`,
        0,
      );
    }

    return {
      productId: Number(raw.product_id),
      name: raw.product_name,
      // menu.getProducts has no description field — see PosterProduct's doc comment.
      description: '',
      price,
      type,
      inStopList: raw.hidden === '1',
    };
  });
}

export async function getProductIngredients(
  token: string,
  productId: number,
): Promise<PosterIngredientRef[]> {
  let response: Response;
  try {
    response = await fetch(
      `${POSTER_BASE_URL}/menu.getProduct?token=${token}&product_id=${productId}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster API: ${message}`, 0);
  }

  if (!response.ok) {
    throw new PosterApiError(
      `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const { response: detail } = (await response.json()) as {
    response: RawPosterProductDetail;
  };

  // Only тех.карта (recipe) products have an `ingredients` array at all —
  // a товар (retail item) legitimately has none, that's not an error here.
  if (!detail.ingredients) {
    return [];
  }

  return detail.ingredients.map((raw) => ({ name: raw.ingredient_name }));
}
