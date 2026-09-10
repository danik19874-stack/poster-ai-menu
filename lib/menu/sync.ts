import type { SupabaseClient } from '@supabase/supabase-js';
import type { PosterIngredientRef, PosterProduct } from '../poster/types';

type GetProductsFn = (token: string) => Promise<PosterProduct[]>;
type GetProductIngredientsFn = (
  token: string,
  productId: number,
) => Promise<PosterIngredientRef[]>;

export async function syncMenu(
  supabase: SupabaseClient,
  deps: { getProducts: GetProductsFn; getProductIngredients: GetProductIngredientsFn },
  args: { restaurantId: string; posterToken: string },
): Promise<void> {
  const products = await deps.getProducts(args.posterToken);

  const rows = await Promise.all(
    products
      // полуфабрикаты — внутренние компоненты рецептов (например, тесто
      // внутри круассана), не отдельные блюда, которые гость может заказать.
      .filter((product) => product.type !== 1)
      .map(async (product) => {
        let ingredients: PosterIngredientRef[];
        let ingredientsKnown: boolean;

        if (product.type === 2) {
          // тех.карта — реальное блюдо с рецептом. Список меню
          // (menu.getProducts) состав не отдаёт вообще — только отдельный
          // вызов menu.getProduct по каждому товару.
          ingredients = await deps.getProductIngredients(args.posterToken, product.productId);
          ingredientsKnown = ingredients.length > 0;
        } else {
          // товар (например, бутылка воды) — рецепта не предполагается по
          // своей природе, это не пробел в данных, а нормальное состояние.
          ingredients = [];
          ingredientsKnown = true;
        }

        return {
          restaurant_id: args.restaurantId,
          poster_product_id: product.productId,
          name: product.name,
          description: product.description,
          price: product.price,
          ingredients,
          ingredients_known: ingredientsKnown,
          in_stop_list: product.inStopList,
          updated_at: new Date().toISOString(),
        };
      }),
  );

  const { error } = await supabase
    .from('menu_items')
    .upsert(rows, { onConflict: 'restaurant_id,poster_product_id' });

  if (error) {
    throw new Error(`Failed to sync menu: ${error.message}`);
  }
}
