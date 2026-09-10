import { describe, it, expect, vi } from 'vitest';
import { createTableOrder } from './createTableOrder';
import { PosterApiError } from '../poster/types';

describe('createTableOrder', () => {
  it('looks up the restaurant, then submits an incoming order with the table number in the comment and a placeholder phone', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({
      posterSpotId: 42,
      posterToken: 'tok',
    });
    const createIncomingOrder = vi.fn().mockResolvedValue({
      incomingOrderId: 106,
      status: 0,
    });

    const result = await createTableOrder(
      { getRestaurant, createIncomingOrder },
      {
        restaurantId: 'r1',
        tableLabel: '7',
        items: [{ productId: 169, count: 2 }],
      },
    );

    expect(getRestaurant).toHaveBeenCalledWith('r1');
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

  it('rejects an empty item list before calling Poster at all', async () => {
    const getRestaurant = vi.fn();
    const createIncomingOrder = vi.fn();

    await expect(
      createTableOrder(
        { getRestaurant, createIncomingOrder },
        { restaurantId: 'r1', tableLabel: '7', items: [] },
      ),
    ).rejects.toThrow('at least one item');
    expect(getRestaurant).not.toHaveBeenCalled();
    expect(createIncomingOrder).not.toHaveBeenCalled();
  });

  it('propagates a getRestaurant failure without calling createIncomingOrder', async () => {
    const restaurantError = new Error('Restaurant not found: r1');
    const getRestaurant = vi.fn().mockRejectedValue(restaurantError);
    const createIncomingOrder = vi.fn();

    await expect(
      createTableOrder(
        { getRestaurant, createIncomingOrder },
        {
          restaurantId: 'r1',
          tableLabel: '7',
          items: [{ productId: 169, count: 2 }],
        },
      ),
    ).rejects.toThrow(restaurantError);
    expect(createIncomingOrder).not.toHaveBeenCalled();
  });

  it('propagates a createIncomingOrder failure un-swallowed', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({
      posterSpotId: 42,
      posterToken: 'tok',
    });
    const posterError = new PosterApiError('Poster API request failed with status 500', 500);
    const createIncomingOrder = vi.fn().mockRejectedValue(posterError);

    await expect(
      createTableOrder(
        { getRestaurant, createIncomingOrder },
        {
          restaurantId: 'r1',
          tableLabel: '7',
          items: [{ productId: 169, count: 2 }],
        },
      ),
    ).rejects.toThrow(posterError);
  });
});
