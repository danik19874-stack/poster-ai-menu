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

/** Poster's order service-mode codes: 1 = dine-in, 2 = takeout, 3 = delivery. */
export type PosterServiceMode = 1 | 2 | 3;

export interface CreateIncomingOrderItem {
  productId: number;
  count: number;
  modificatorId?: number;
}

export interface CreateIncomingOrderRequest {
  spotId: number;
  /** Poster requires phone or client_id — see design spec for the placeholder-phone decision for anonymous QR guests. */
  phone: string;
  skipPhoneValidation?: boolean;
  serviceMode: PosterServiceMode;
  /** Table number as free text — this endpoint has no structured table field. e.g. "Стол 7" */
  comment?: string;
  products: CreateIncomingOrderItem[];
}

export interface CreateIncomingOrderResult {
  incomingOrderId: number;
  /** Poster's incoming-order status: 0 = new/pending staff confirmation, 1 = accepted, 7 = canceled. */
  status: number;
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
