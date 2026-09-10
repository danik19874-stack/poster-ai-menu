import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncMenu } from './sync';
import type { PosterProduct } from '../poster/types';

describe('syncMenu', () => {
  it('fetches real ingredients for тех.карта items, marks товар items as ingredients-unverified, and skips полуфабрикаты', async () => {
    const products: PosterProduct[] = [
      {
        productId: 1,
        name: 'Полуфабрикат теста',
        description: '',
        price: 0,
        type: 1,
        inStopList: false,
      },
      {
        productId: 3,
        name: 'Капучино 250 мл',
        description: '',
        price: 300,
        type: 2,
        inStopList: false,
      },
      {
        productId: 5,
        name: 'Вода минеральная',
        description: '',
        price: 1000,
        type: 3,
        inStopList: false,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi
      .fn()
      .mockResolvedValue([{ name: 'Кофе' }, { name: 'Молоко' }]);

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    await syncMenu(
      supabase as unknown as SupabaseClient,
      { getProducts, getProductIngredients },
      { restaurantId: 'r1', posterToken: 'tok' },
    );

    expect(getProductIngredients).toHaveBeenCalledTimes(1);
    expect(getProductIngredients).toHaveBeenCalledWith('tok', 3);

    const [rows] = upsert.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows).toEqual([
      expect.objectContaining({
        poster_product_id: 3,
        ingredients: [{ name: 'Кофе' }, { name: 'Молоко' }],
        ingredients_known: true,
      }),
      expect.objectContaining({
        poster_product_id: 5,
        ingredients: [],
        ingredients_known: false,
      }),
    ]);
  });

  it('marks a тех.карта with an empty recipe as ingredients_known: false (nobody filled it in yet)', async () => {
    const products: PosterProduct[] = [
      {
        productId: 3,
        name: 'Блюдо без заполненного рецепта',
        description: '',
        price: 300,
        type: 2,
        inStopList: false,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi.fn().mockResolvedValue([]);

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    await syncMenu(
      supabase as unknown as SupabaseClient,
      { getProducts, getProductIngredients },
      { restaurantId: 'r1', posterToken: 'tok' },
    );

    const [rows] = upsert.mock.calls[0];
    expect(rows[0]).toEqual(expect.objectContaining({ ingredients: [], ingredients_known: false }));
  });

  it('isolates a single getProductIngredients failure instead of failing the whole sync', async () => {
    const products: PosterProduct[] = [
      {
        productId: 3,
        name: 'Капучино 250 мл',
        description: '',
        price: 300,
        type: 2,
        inStopList: false,
      },
      {
        productId: 4,
        name: 'Латте 350 мл',
        description: '',
        price: 350,
        type: 2,
        inStopList: false,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([{ name: 'Молоко' }]);

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await syncMenu(
      supabase as unknown as SupabaseClient,
      { getProducts, getProductIngredients },
      { restaurantId: 'r1', posterToken: 'tok' },
    );

    expect(getProductIngredients).toHaveBeenCalledTimes(2);

    const [rows] = upsert.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        poster_product_id: 3,
        ingredients: [],
        ingredients_known: false,
      }),
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        poster_product_id: 4,
        ingredients: [{ name: 'Молоко' }],
        ingredients_known: true,
      }),
    );
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
