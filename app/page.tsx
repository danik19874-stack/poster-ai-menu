import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <span className={styles.eyebrow}>Poster POS · интеграция</span>
        <h1 className={styles.title}>ИИ-меню для гостей</h1>
        <p className={styles.description}>
          Гостевое меню по QR-коду с ИИ-консультантом по составу блюд — подключается напрямую
          к вашему аккаунту Poster, без ручного ввода токенов.
        </p>
        <a className={styles.cta} href="/api/oauth/start">
          Подключить заведение
        </a>
        <a className={styles.adminLink} href="/admin">
          Вход для администратора
        </a>
      </main>
    </div>
  );
}
