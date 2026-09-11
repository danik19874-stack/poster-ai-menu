import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./admin.module.css";

export default async function AdminDashboard() {
  const supabase = getSupabaseServerClient();
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "";

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  const { count: totalRestaurants } = await supabase
    .from("restaurants")
    .select("*", { count: "exact", head: true });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const { data: recentActivity } = await supabase
    .from("activity_log")
    .select("restaurant_id")
    .gte("created_at", thirtyDaysAgo.toISOString());
  const activeRestaurants30d = new Set((recentActivity ?? []).map((r) => r.restaurant_id)).size;

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const { data: todayActivity } = await supabase
    .from("activity_log")
    .select("kind")
    .gte("created_at", startOfToday.toISOString());
  const ordersToday = (todayActivity ?? []).filter((r) => r.kind === "order").length;
  const aiQueriesToday = (todayActivity ?? []).filter((r) => r.kind === "ai_query").length;

  const { data: keys } = await supabase
    .from("gemini_api_keys")
    .select("id, label, model, daily_limit, requests_today, usage_date, is_active")
    .order("label", { ascending: true })
    .order("priority", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Админка</h1>
        <form method="POST" action="/api/admin/logout">
          <button className={styles.logoutButton} type="submit">
            Выйти
          </button>
        </form>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <p className={styles.statValue}>{totalRestaurants ?? 0}</p>
          <p className={styles.statLabel}>Подключений всего</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{activeRestaurants30d}</p>
          <p className={styles.statLabel}>Активны за 30 дней</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{ordersToday}</p>
          <p className={styles.statLabel}>Заказов сегодня</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{aiQueriesToday}</p>
          <p className={styles.statLabel}>ИИ-запросов сегодня</p>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Заведения</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Название</th>
            <th>Подключено</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(restaurants ?? []).map((restaurant) => (
            <tr key={restaurant.id}>
              <td>{restaurant.name}</td>
              <td>{new Date(restaurant.created_at).toLocaleDateString("ru-RU")}</td>
              <td>
                <a
                  href={`${origin}/connected?restaurant=${restaurant.id}&name=${encodeURIComponent(restaurant.name)}`}
                  className={styles.toggleButton}
                >
                  Ссылка и QR
                </a>
              </td>
              <td>
                <form method="POST" action={`/api/admin/restaurants/${restaurant.id}/sync-menu`}>
                  <button className={styles.toggleButton} type="submit">
                    Обновить меню
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {(restaurants ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className={styles.empty}>
                Заведений пока нет.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className={styles.sectionTitle}>Ключи Gemini</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Название</th>
            <th>Модель</th>
            <th>Использовано сегодня</th>
            <th>Статус</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(keys ?? []).map((key) => {
            const usedToday = key.usage_date === today ? key.requests_today : 0;
            return (
              <tr key={key.id}>
                <td>{key.label}</td>
                <td>{key.model}</td>
                <td>
                  {usedToday} / {key.daily_limit}
                </td>
                <td>{key.is_active ? "включён" : "выключен"}</td>
                <td>
                  <form method="POST" action={`/api/admin/keys/${key.id}/toggle`}>
                    <button className={styles.toggleButton} type="submit">
                      {key.is_active ? "Выключить" : "Включить"}
                    </button>
                  </form>
                </td>
                <td>
                  <form method="POST" action={`/api/admin/keys/${key.id}/delete`}>
                    <button className={styles.dangerButton} type="submit">
                      Удалить
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
          {(keys ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className={styles.empty}>
                Ключей пока нет — добавьте первый ниже.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className={styles.sectionTitle}>Добавить ключ</h2>
      <p className={styles.hint}>
        Один настоящий ключ Gemini добавляется один раз — он автоматически заведётся сразу под все
        модели из цепочки (каждая модель на стороне Google считает лимит отдельно).
      </p>
      <form className={styles.addForm} method="POST" action="/api/admin/keys">
        <input className={styles.input} name="label" placeholder="Название (например, «ключ 2»)" required />
        <input className={styles.input} name="api_key" placeholder="Значение ключа" required />
        <button className={styles.button} type="submit">
          Добавить
        </button>
      </form>
    </div>
  );
}
