import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import AskAboutDish from "./AskAboutDish";
import styles from "./detail.module.css";

interface IngredientRef {
  name: string;
}

export default async function DishDetail({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const supabase = getSupabaseServerClient();

  const { data: item } = await supabase
    .from("menu_items")
    .select("id, name, description, price, ingredients, ingredients_known, photo_url")
    .eq("id", itemId)
    .single();

  if (!item) {
    notFound();
  }

  const ingredients = (item.ingredients as IngredientRef[] | null) ?? [];

  return (
    <div className={styles.page}>
      <Link href="/menu-preview" className={styles.back}>
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
      </div>

      <AskAboutDish
        dishName={item.name}
        ingredientsKnown={item.ingredients_known}
        ingredientNames={ingredients.map((i) => i.name)}
      />
    </div>
  );
}
