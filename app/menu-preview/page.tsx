import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./menu.module.css";

export default async function MenuPreview() {
  const supabase = getSupabaseServerClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .single();

  const items = restaurant
    ? (
        await supabase
          .from("menu_items")
          .select("id, name, description, price, ingredients_known, photo_url")
          .eq("restaurant_id", restaurant.id)
          .order("name")
      ).data ?? []
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <span className={styles.eyebrow}>Реальное меню · подключено через Poster</span>
        <h1 className={styles.restaurantName}>{restaurant?.name ?? "Меню не подключено"}</h1>
        <p className={styles.restaurantMeta}>Стол 7 · меню синхронизировано с кассой</p>
      </div>

      <section className={styles.section}>
        <div className={styles.list}>
          {items.map((item) => (
            <Link key={item.id} href={`/menu-preview/${item.id}`} className={styles.row}>
              <div className={styles.rowMain}>
                <p className={styles.rowName}>{item.name}</p>
                <p className={styles.rowDesc}>
                  {item.description || "Описание уточняется у заведения"}
                </p>
                <div className={styles.rowFooter}>
                  <span className={styles.price}>{item.price} ₸</span>
                  {!item.ingredients_known && (
                    <span className={styles.badgeMuted}>Состав уточняется</span>
                  )}
                </div>
              </div>
              <div className={styles.photo} aria-hidden="true">
                {item.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photo_url} alt="" />
                )}
              </div>
            </Link>
          ))}
          {items.length === 0 && (
            <p className={styles.rowDesc} style={{ padding: "18px 20px" }}>
              Меню пока пустое — синхронизация с Poster ещё не выполнялась.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
