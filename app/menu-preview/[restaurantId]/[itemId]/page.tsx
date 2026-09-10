import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import AskAboutDish from "./AskAboutDish";
import AddToCart from "./AddToCart";
import styles from "./detail.module.css";

interface IngredientRef {
  name: string;
}

export default async function DishDetail({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string; itemId: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { restaurantId, itemId } = await params;
  const { table } = await searchParams;
  const supabase = getSupabaseServerClient();

  const { data: item } = await supabase
    .from("menu_items")
    .select("id, poster_product_id, name, description, price, ingredients, ingredients_known, photo_url")
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (!item) {
    notFound();
  }

  const ingredients = (item.ingredients as IngredientRef[] | null) ?? [];
  const backHref = `/menu-preview/${restaurantId}${table ? `?table=${table}` : ""}`;

  return (
    <div className={styles.page}>
      <Link href={backHref} className={styles.back}>
        ← Назад в меню
      </Link>

      <div className={styles.photo} aria-hidden="true">
        {item.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo_url} alt="" />
        )}
      </div>

      <div className={styles.body}>
        <h1 className={styles.name}>{item.name}</h1>
        <div className={styles.priceRow}>
          <span className={styles.price}>{item.price} ₸</span>
        </div>
        <p className={styles.description}>
          {item.description || "Описание уточняется у заведения"}
        </p>

        <div className={styles.ingredientsBlock}>
          <p className={styles.ingredientsTitle}>Состав</p>
          {item.ingredients_known && ingredients.length > 0 ? (
            <ul className={styles.ingredientsList}>
              {ingredients.map((ingredient) => (
                <li key={ingredient.name} className={styles.ingredientChip}>
                  {ingredient.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.unknownNotice}>
              Точный состав пока не подтверждён заведением — уточните у официанта.
            </p>
          )}
        </div>

        <AddToCart
          table={table}
          productId={item.poster_product_id}
          menuItemId={item.id}
          name={item.name}
          price={item.price}
        />
      </div>

      <AskAboutDish
        dishName={item.name}
        ingredientsKnown={item.ingredients_known}
        ingredientNames={ingredients.map((i) => i.name)}
      />
    </div>
  );
}
