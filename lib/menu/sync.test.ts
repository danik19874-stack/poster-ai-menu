import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncMenu } from './sync';
import type { PosterProduct } from '../poster/types';

function mockMenuItemsTable(upsertResult: { error: unknown } = { error: null }) {
  const upsert = vi.fn().mockResolvedValue(upsertResult);
  const notFn = vi.fn().mockResolvedValue({ error: null });
  const eqFn = vi.fn().mockReturnValue({ not: notFn });
  const deleteFn = vi.fn().mockReturnValue({ eq: eqFn });
  const from = vi.fn().mockReturnValue({ upsert, delete: deleteFn });
  return { from, upsert, deleteFn, eqFn, notFn };
}

describe('syncMenu', () => {
  it('fetches real ingredients for тех.карта items, marks товар items as ingredients-unverified, and skips полуфабрикаты', async () => {
    const products: PosterProduct[] = [
      {
        productId: 1,
        name: 'Полуфабрикат теста',
        description: '',
        categoryName: null,
        price: 0,
        type: 1,
        inStopList: false,
        photoUrl: null,
      },
      {
        productId: 3,
        name: 'Капучино 250 мл',
        description: '',
        categoryName: 'Кофе',
        price: 300,
        type: 2,
        inStopList: false,
        photoUrl: null,
      },
      {
        productId: 5,
        name: 'Вода минеральная',
        description: '',
        categoryName: null,
        price: 1000,
        type: 3,
        inStopList: false,
        photoUrl: null,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi
      .fn()
      .mockResolvedValue([{ name: 'Кофе' }, { name: 'Молоко' }]);

    const { from, upsert } = mockMenuItemsTable();
    const supabase = { from };

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
        category_name: 'Кофе',
      }),
      expect.objectContaining({
        poster_product_id: 5,
        ingredients: [],
        ingredients_known: false,
        category_name: null,
      }),
    ]);
  });

  it('marks a тех.карта with an empty recipe as ingredients_known: false (nobody filled it in yet)', async () => {
    const products: PosterProduct[] = [
      {
        productId: 3,
        name: 'Блюдо без заполненного рецепта',
        description: '',
        categoryName: null,
        price: 300,
        type: 2,
        inStopList: false,
        photoUrl: null,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi.fn().mockResolvedValue([]);

    const { from, upsert } = mockMenuItemsTable();
    const supabase = { from };

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
        categoryName: null,
        price: 300,
        type: 2,
        inStopList: false,
        photoUrl: null,
      },
      {
        productId: 4,
        name: 'Латте 350 мл',
        description: '',
        categoryName: null,
        price: 350,
        type: 2,
        inStopList: false,
        photoUrl: null,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([{ name: 'Молоко' }]);

    const { from, upsert } = mockMenuItemsTable();
    const supabase = { from };
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

  it('removes menu_items that Poster no longer returns (deleted/renamed at the register)', async () => {
    const products: PosterProduct[] = [
      {
        productId: 3,
        name: 'Капучино 250 мл',
        description: '',
        categoryName: 'Кофе',
        price: 300,
        type: 3,
        inStopList: false,
        photoUrl: null,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi.fn();

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const notFn = vi.fn().mockResolvedValue({ error: null });
    const eqFn = vi.fn().mockReturnValue({ not: notFn });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqFn });
    const supabase = { from: vi.fn().mockReturnValue({ upsert, delete: deleteFn }) };

    await syncMenu(
      supabase as unknown as SupabaseClient,
      { getProducts, getProductIngredients },
      { restaurantId: 'r1', posterToken: 'tok' },
    );

    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(eqFn).toHaveBeenCalledWith('restaurant_id', 'r1');
    expect(notFn).toHaveBeenCalledWith('poster_product_id', 'in', '(3)');
  });

  it('does not wipe the cached menu when Poster returns zero products (likely a transient blip, not an intentionally emptied menu)', async () => {
    const getProducts = vi.fn().mockResolvedValue([]);
    const getProductIngredients = vi.fn();

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const deleteFn = vi.fn();
    const supabase = { from: vi.fn().mockReturnValue({ upsert, delete: deleteFn }) };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await syncMenu(
      supabase as unknown as SupabaseClient,
      { getProducts, getProductIngredients },
      { restaurantId: 'r1', posterToken: 'tok' },
    );

    expect(deleteFn).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
