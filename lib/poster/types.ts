export interface PosterIngredientRef {
  name: string;
}

export interface PosterProduct {
  productId: number;
  name: string;
  description: string;
  /** Normalized to major currency units (e.g. tenge) — NOT Poster's raw minor-unit price. */
  price: number;
  ingredients: PosterIngredientRef[] | null;
  inStopList: boolean;
}

export interface CreateOrderItem {
  productId: number;
  count: number;
  modificatorId?: number;
}

/** Poster's order service-mode codes: 1 = dine-in, 2 = takeout, 3 = delivery. */
export type PosterServiceMode = 1 | 2 | 3;

export interface CreateOrderRequest {
  spotId: number;
  tableId: number;
  serviceMode: PosterServiceMode;
  autoAccept: boolean;
  products: CreateOrderItem[];
}

export interface CreateOrderResponse {
  response: {
    id: number;
    status: number;
    spotId: number;
    tableId: number;
  };
}

export class PosterApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PosterApiError';
  }
}
