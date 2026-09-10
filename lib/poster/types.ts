export interface PosterIngredientRef {
  name: string;
}

/**
 * Poster product types: 1 = полуфабрикат (semi-finished component, not a
 * guest-orderable dish), 2 = тех.карта (a recipe/dish — the only type that
 * carries a real ingredient breakdown, and only via getProduct, not
 * getProducts), 3 = товар (a plain retail item, e.g. bottled water — has no
 * recipe by design, not a data gap).
 */
export type PosterProductType = 1 | 2 | 3;

export interface PosterProduct {
  productId: number;
  name: string;
  /**
   * Poster's product-list endpoint (menu.getProducts) has no description
   * field at all — always empty string from that source today. Left in the
   * domain type for a future manual-entry path, not currently populated.
   */
  description: string;
  /** Normalized to major currency units (e.g. tenge) — NOT Poster's raw minor-unit price. */
  price: number;
  type: PosterProductType;
  inStopList: boolean;
  /** Absolute URL — Poster's raw `photo` field is host-relative. Null if the product has no photo. */
  photoUrl: string | null;
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
