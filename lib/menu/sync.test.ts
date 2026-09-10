import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncMenu } from './sync';
import type { PosterProduct } from '../poster/types';

describe('syncMenu', () => {
  it('upserts each Poster product into menu_items with ingredients_known derived from ingredients', async () => {
    const products: PosterProduct[] = [
      {
        productId: 169,
        name: 'Стейк рибай',
        description: 'Сочный стейк',
        price: 4200,
        ingredients: [{ name: 'говядина' }],
        inStopList: false,
      },
      {
        productId: 170,
        name: 'Салат без состава',
        description: '',
        price: 1500,
        ingredients: null,
        inStopList: false,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    await syncMenu(supabase as unknown as SupabaseClient, getProducts, {
      restaurantId: 'r1',
      posterToken: 'tok',
    });

    expect(getProducts).toHaveBeenCalledWith('tok');
    expect(supabase.from).toHaveBeenCalledWith('menu_items');
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          restaurant_id: 'r1',
          poster_product_id: 169,
          ingredients: [{ name: 'говядина' }],
          ingredients_known: true,
        }),
        expect.objectContaining({
          restaurant_id: 'r1',
          poster_product_id: 170,
          ingredients: null,
          ingredients_known: false,
        }),
      ],
      { onConflict: 'restaurant_id,poster_product_id' },
    );
  });
});
