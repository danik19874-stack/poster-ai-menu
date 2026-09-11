import styles from "./login.module.css";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className={styles.page}>
      <form className={styles.card} method="POST" action="/api/admin/login">
        <h1 className={styles.title}>Вход в админку</h1>
        {error && <p className={styles.error}>Неверный пароль</p>}
        <input
          className={styles.input}
          type="password"
          name="password"
          placeholder="Пароль"
          autoFocus
        />
        <button className={styles.button} type="submit">
          Войти
        </button>
      </form>
    </div>
  );
}
