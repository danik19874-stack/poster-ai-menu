import type { SupabaseClient } from '@supabase/supabase-js';
import type { PosterIngredientRef, PosterProduct } from '../poster/types';

type GetProductsFn = (token: string) => Promise<PosterProduct[]>;
type GetProductIngredientsFn = (
  token: string,
  productId: number,
) => Promise<PosterIngredientRef[]>;

interface MenuItemRow {
  restaurant_id: string;
  poster_product_id: number;
  name: string;
  description: string;
  category_name: string | null;
  price: number;
  ingredients: PosterIngredientRef[];
  ingredients_known: boolean;
  in_stop_list: boolean;
  photo_url: string | null;
  updated_at: string;
}

export async function syncMenu(
  supabase: SupabaseClient,
  deps: { getProducts: GetProductsFn; getProductIngredients: GetProductIngredientsFn },
  args: { restaurantId: string; posterToken: string },
): Promise<void> {
  const products = await deps.getProducts(args.posterToken);

  const rows: MenuItemRow[] = [];

  // Sequential on purpose (not Promise.all): Poster does not document a safe
  // concurrency limit for per-product menu.getProduct calls, and — more
  // importantly — a single failing item (network blip, rate limit, a
  // malformed response) must not take down the whole sync for a restaurant
  // that can have 200+ dishes. Each product is handled in isolation below.
  for (const product of products) {
    // полуфабрикаты — внутренние компоненты рецептов (например, тесто
    // внутри круассана), не отдельные блюда, которые гость может заказать.
    if (product.type === 1) {
      continue;
    }

    let ingredients: PosterIngredientRef[];
    let ingredientsKnown: boolean;

    if (product.type === 2) {
      // тех.карта — реальное блюдо с рецептом. Список меню
      // (menu.getProducts) состав не отдаёт вообще — только отдельный
      // вызов menu.getProduct по каждому товару.
      try {
        ingredients = await deps.getProductIngredients(args.posterToken, product.productId);
        ingredientsKnown = ingredients.length > 0;
      } catch (err) {
        // Do not let one bad product (network error, rate limit, malformed
        // response) fail the entire menu sync — the other dishes may well
        // have synced fine. Fall back to the same safe "not verified"
        // default used for an empty recipe, and keep going.
        console.error(
          `syncMenu: failed to fetch ingredients for product ${product.productId} (${product.name}):`,
          err,
        );
        ingredients = [];
        ingredientsKnown = false;
      }
    } else {
      // товар (например, бутылка воды или упакованный снек) — Poster не
      // хранит состав для этой категории структурно, это категория учёта
      // склада, а не пробел в данных, который можно было бы дозаполнить
      // синком. Но это НЕ гарантия отсутствия аллергенов: у бутилированного
      // смузи или упакованного снека вполне может быть реальный состав,
      // которого просто нет в Poster. Поэтому ставим "не проверено", а не
      // "проверено и пусто" — безопасное умолчание в сторону осторожности.
      // Будущее улучшение: отдельное состояние "неприменимо" на уровне
      // схемы, не в этой задаче.
      ingredients = [];
      ingredientsKnown = false;
    }

    rows.push({
      restaurant_id: args.restaurantId,
      poster_product_id: product.productId,
      name: product.name,
      description: product.description,
      category_name: product.categoryName,
      price: product.price,
      ingredients,
      ingredients_known: ingredientsKnown,
      in_stop_list: product.inStopList,
      photo_url: product.photoUrl,
      updated_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from('menu_items')
    .upsert(rows, { onConflict: 'restaurant_id,poster_product_id' });

  if (error) {
    throw new Error(`Failed to sync menu: ${error.message}`);
  }

  // Poster's product list is the source of truth: a dish removed/renamed at the
  // register must disappear from the guest menu too, or a guest can add an
  // item to their order that Poster will then reject at checkout. An empty
  // `rows` almost always means a transient API hiccup, not the owner
  // deliberately emptying their whole menu — wiping everything on that signal
  // would be worse than leaving stale data, so skip the delete and log instead.
  if (rows.length === 0) {
    console.error(
      `syncMenu: Poster returned 0 sellable products for restaurant ${args.restaurantId} — skipping stale-item cleanup to avoid wiping the cached menu on a possible transient response.`,
    );
    return;
  }

  const currentProductIds = rows.map((row) => row.poster_product_id);
  const { error: deleteError } = await supabase
    .from('menu_items')
    .delete()
    .eq('restaurant_id', args.restaurantId)
    .not('poster_product_id', 'in', `(${currentProductIds.join(',')})`);

  if (deleteError) {
    throw new Error(`Failed to remove stale menu items: ${deleteError.message}`);
  }
}
