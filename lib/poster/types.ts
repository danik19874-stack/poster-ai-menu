export interface PosterIngredientRef {
  name: string;
}

export interface PosterProduct {
  productId: number;
  name: string;
  description: string;
  price: number;
  ingredients: PosterIngredientRef[] | null;
  inStopList: boolean;
}

export interface CreateOrderItem {
  productId: number;
  count: number;
  modificatorId?: number;
}

export interface CreateOrderRequest {
  spotId: number;
  tableId: number;
  serviceMode: 1 | 2 | 3;
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
