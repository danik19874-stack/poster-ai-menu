import type { SupabaseClient } from '@supabase/supabase-js';
import type { PosterProduct } from '../poster/types';

type GetProductsFn = (token: string) => Promise<PosterProduct[]>;

export async function syncMenu(
  supabase: SupabaseClient,
  getProducts: GetProductsFn,
  args: { restaurantId: string; posterToken: string },
): Promise<void> {
  const products = await getProducts(args.posterToken);

  const rows = products.map((product) => ({
    restaurant_id: args.restaurantId,
    poster_product_id: product.productId,
    name: product.name,
    description: product.description,
    price: product.price,
    ingredients: product.ingredients,
    ingredients_known: product.ingredients !== null,
    in_stop_list: product.inStopList,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('menu_items')
    .upsert(rows, { onConflict: 'restaurant_id,poster_product_id' });

  if (error) {
    throw new Error(`Failed to sync menu: ${error.message}`);
  }
}
