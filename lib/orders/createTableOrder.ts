import type {
  CreateIncomingOrderItem,
  CreateIncomingOrderResult,
} from '../poster/types';

/**
 * Poster requires phone or client_id on every incoming order; guests here
 * are anonymous (no login, no phone collected — see design spec). Known
 * MVP limitation: all QR orders for a restaurant attribute to this one
 * placeholder "customer" in Poster's own client records.
 */
const QR_GUEST_PLACEHOLDER_PHONE = '+00000000000';

interface RestaurantLookup {
  posterSpotId: number;
  posterToken: string;
}

interface Deps {
  getRestaurant: (restaurantId: string) => Promise<RestaurantLookup>;
  createIncomingOrder: (
    token: string,
    order: {
      spotId: number;
      phone: string;
      skipPhoneValidation: true;
      serviceMode: 1;
      comment: string;
      products: CreateIncomingOrderItem[];
    },
  ) => Promise<CreateIncomingOrderResult>;
}

interface CreateTableOrderArgs {
  restaurantId: string;
  tableLabel: string;
  items: CreateIncomingOrderItem[];
}

export async function createTableOrder(
  deps: Deps,
  args: CreateTableOrderArgs,
): Promise<{ posterIncomingOrderId: number }> {
  if (args.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  const restaurant = await deps.getRestaurant(args.restaurantId);

  const result = await deps.createIncomingOrder(restaurant.posterToken, {
    spotId: restaurant.posterSpotId,
    phone: QR_GUEST_PLACEHOLDER_PHONE,
    skipPhoneValidation: true,
    serviceMode: 1,
    comment: `Стол ${args.tableLabel}`,
    products: args.items,
  });

  return { posterIncomingOrderId: result.incomingOrderId };
}
