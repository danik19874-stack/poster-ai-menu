import { describe, it, expect, vi } from 'vitest';
import { createTableOrder, StopListedItemsError } from './createTableOrder';
import { PosterApiError } from '../poster/types';
import type { PosterProduct } from '../poster/types';

function product(overrides: Partial<PosterProduct>): PosterProduct {
  return {
    productId: 169,
    name: 'Капучино',
    description: '',
    categoryName: null,
    price: 1200,
    type: 2,
    inStopList: false,
    photoUrl: null,
    ...overrides,
  };
}

describe('createTableOrder', () => {
  it('looks up the restaurant, checks the live stop list, then submits the order', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({
      posterSpotId: 42,
      posterToken: 'tok',
    });
    const getProducts = vi.fn().mockResolvedValue([product({ productId: 169, inStopList: false })]);
    const createIncomingOrder = vi.fn().mockResolvedValue({
      incomingOrderId: 106,
      status: 0,
    });

    const result = await createTableOrder(
      { getRestaurant, getProducts, createIncomingOrder },
      {
        restaurantId: 'r1',
        tableLabel: '7',
        items: [{ productId: 169, count: 2 }],
      },
    );

    expect(getRestaurant).toHaveBeenCalledWith('r1');
    expect(getProducts).toHaveBeenCalledWith('tok');
    expect(createIncomingOrder).toHaveBeenCalledWith('tok', {
      spotId: 42,
      phone: '+00000000000',
      skipPhoneValidation: true,
      serviceMode: 1,
      comment: 'Стол 7',
      products: [{ productId: 169, count: 2 }],
    });
    expect(result).toEqual({ posterIncomingOrderId: 106 });
  });

  it('rejects the order without contacting Poster when a cart item is currently on the stop list', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({
      posterSpotId: 42,
      posterToken: 'tok',
    });
    const getProducts = vi.fn().mockResolvedValue([
      product({ productId: 169, name: 'Капучино', inStopList: true }),
      product({ productId: 200, name: 'Круассан', inStopList: false }),
    ]);
    const createIncomingOrder = vi.fn();

    const error = await createTableOrder(
      { getRestaurant, getProducts, createIncomingOrder },
      {
        restaurantId: 'r1',
        tableLabel: '7',
        items: [
          { productId: 169, count: 1 },
          { productId: 200, count: 1 },
        ],
      },
    ).catch((e) => e);

    expect(error).toBeInstanceOf(StopListedItemsError);
    expect((error as StopListedItemsError).items).toEqual(['Капучино']);
    expect(createIncomingOrder).not.toHaveBeenCalled();
  });

  it('lists every stop-listed item when more than one is affected', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({ posterSpotId: 42, posterToken: 'tok' });
    const getProducts = vi.fn().mockResolvedValue([
      product({ productId: 169, name: 'Капучино', inStopList: true }),
      product({ productId: 200, name: 'Круассан', inStopList: true }),
    ]);
    const createIncomingOrder = vi.fn();

    const error = await createTableOrder(
      { getRestaurant, getProducts, createIncomingOrder },
      {
        restaurantId: 'r1',
        tableLabel: '7',
        items: [
          { productId: 169, count: 1 },
          { productId: 200, count: 1 },
        ],
      },
    ).catch((e) => e);

    expect(error).toBeInstanceOf(StopListedItemsError);
    expect((error as StopListedItemsError).items).toEqual(['Капучино', 'Круассан']);
  });

  it('does not block the order when a cart product is missing from the live product list', async () => {
    // A deleted-from-Poster or not-yet-synced product: fail open rather than
    // silently blocking a guest's order over a lookup gap unrelated to the
    // stop list itself.
    const getRestaurant = vi.fn().mockResolvedValue({ posterSpotId: 42, posterToken: 'tok' });
    const getProducts = vi.fn().mockResolvedValue([]);
    const createIncomingOrder = vi.fn().mockResolvedValue({ incomingOrderId: 1, status: 0 });

    await expect(
      createTableOrder(
        { getRestaurant, getProducts, createIncomingOrder },
        { restaurantId: 'r1', tableLabel: '7', items: [{ productId: 169, count: 1 }] },
      ),
    ).resolves.toEqual({ posterIncomingOrderId: 1 });
  });

  it('rejects an empty item list before calling Poster at all', async () => {
    const getRestaurant = vi.fn();
    const getProducts = vi.fn();
    const createIncomingOrder = vi.fn();

    await expect(
      createTableOrder(
        { getRestaurant, getProducts, createIncomingOrder },
        { restaurantId: 'r1', tableLabel: '7', items: [] },
      ),
    ).rejects.toThrow('at least one item');
    expect(getRestaurant).not.toHaveBeenCalled();
    expect(getProducts).not.toHaveBeenCalled();
    expect(createIncomingOrder).not.toHaveBeenCalled();
  });

  it('propagates a getRestaurant failure without calling getProducts or createIncomingOrder', async () => {
    const restaurantError = new Error('Restaurant not found: r1');
    const getRestaurant = vi.fn().mockRejectedValue(restaurantError);
    const getProducts = vi.fn();
    const createIncomingOrder = vi.fn();

    await expect(
      createTableOrder(
        { getRestaurant, getProducts, createIncomingOrder },
        {
          restaurantId: 'r1',
          tableLabel: '7',
          items: [{ productId: 169, count: 2 }],
        },
      ),
    ).rejects.toThrow(restaurantError);
    expect(getProducts).not.toHaveBeenCalled();
    expect(createIncomingOrder).not.toHaveBeenCalled();
  });

  it('propagates a getProducts failure without calling createIncomingOrder', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({ posterSpotId: 42, posterToken: 'tok' });
    const productsError = new PosterApiError('Poster API request failed with status 500', 500);
    const getProducts = vi.fn().mockRejectedValue(productsError);
    const createIncomingOrder = vi.fn();

    await expect(
      createTableOrder(
        { getRestaurant, getProducts, createIncomingOrder },
        {
          restaurantId: 'r1',
          tableLabel: '7',
          items: [{ productId: 169, count: 2 }],
        },
      ),
    ).rejects.toThrow(productsError);
    expect(createIncomingOrder).not.toHaveBeenCalled();
  });

  it('propagates a createIncomingOrder failure un-swallowed', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({
      posterSpotId: 42,
      posterToken: 'tok',
    });
    const getProducts = vi.fn().mockResolvedValue([product({ productId: 169, inStopList: false })]);
    const posterError = new PosterApiError('Poster API request failed with status 500', 500);
    const createIncomingOrder = vi.fn().mockRejectedValue(posterError);

    await expect(
      createTableOrder(
        { getRestaurant, getProducts, createIncomingOrder },
        {
          restaurantId: 'r1',
          tableLabel: '7',
          items: [{ productId: 169, count: 2 }],
        },
      ),
    ).rejects.toThrow(posterError);
  });
});
