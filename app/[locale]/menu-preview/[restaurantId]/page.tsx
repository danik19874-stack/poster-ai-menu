import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { groupByCategory } from "@/lib/menu/groupByCategory";
import CartBar from "./CartBar";
import styles from "./menu.module.css";

export default async function MenuPreview({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { restaurantId } = await params;
  const { table } = await searchParams;
  const supabase = getSupabaseServerClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .single();

  const items = restaurant
    ? (
        await supabase
          .from("menu_items")
          .select("id, name, description, price, ingredients_known, photo_url, category_name")
          .eq("restaurant_id", restaurant.id)
          .order("name")
      ).data ?? []
    : [];

  const groups = groupByCategory(items);
  const showHeaders = groups.length > 1;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <span className={styles.eyebrow}>Реальное меню · подключено через Poster</span>
        <h1 className={styles.restaurantName}>{restaurant?.name ?? "Меню не подключено"}</h1>
        <p className={styles.restaurantMeta}>
          {table ? `Стол ${table}` : "Стол не определён"} · меню синхронизировано с кассой
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.category ?? "_none"} className={styles.section}>
          {showHeaders && group.category && (
            <p className={styles.categoryHeader}>{group.category}</p>
          )}
          <div className={styles.list}>
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={`/menu-preview/${restaurantId}/${item.id}${table ? `?table=${table}` : ""}`}
                className={styles.row}
              >
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
          </div>
        </section>
      ))}
      {items.length === 0 && (
        <p className={styles.rowDesc} style={{ padding: "18px 20px" }}>
          Меню пока пустое — синхронизация с Poster ещё не выполнялась.
        </p>
      )}

      <CartBar restaurantId={restaurantId} table={table} />
    </div>
  );
}
