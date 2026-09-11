import styles from "./page.module.css";

const BENEFITS = [
  {
    title: "Меньше вопросов у официанта",
    text: "Гость получает точный ответ у ИИ прямо за столом, не отвлекая персонал в разгар смены.",
  },
  {
    title: "Честно, а не гладко",
    text: "Если состав блюда не занесён в Poster, ИИ так и скажет — не станет придумывать и подставлять вас перед гостем с аллергией.",
  },
  {
    title: "Заказ доходит за секунды, не минуты",
    text: "Гость оформляет заказ по QR, он сразу на кассе — официант подтверждает одним тапом, а не переписывает с чужих слов.",
  },
  {
    title: "Одна система, а не две",
    text: "Меню синхронизировано напрямую с Poster: обновили цену или стоп-лист на кассе — гость сразу видит актуальное.",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.backdrop} aria-hidden="true" />
        <div className={styles.overlay} aria-hidden="true" />
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>Poster POS · интеграция</span>
          <h1 className={styles.title}>Меню, которое отвечает за вас</h1>
          <p className={styles.subtitle}>
            ИИ-консультант отвечает гостям про состав и аллергены строго по данным из вашей
            кассы — и честно говорит «не знаю, уточните у официанта», если состав ещё не занесён
            в Poster.
          </p>
          <a className={styles.cta} href="/api/oauth/start">
            Подключить заведение
          </a>
          <p className={styles.ctaNote}>Через OAuth Poster — токен вводить руками не нужно.</p>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>Для кого</p>
        <p className={styles.forWhom}>
          Для кафе и ресторанов на Poster, где гости регулярно спрашивают про состав и аллергены,
          а официанты не всегда могут ответить точно с первого раза.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>Что это даёт</p>
        <div className={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className={styles.benefit}>
              <p className={styles.benefitTitle}>{benefit.title}</p>
              <p className={styles.benefitText}>{benefit.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>Почему мы</p>
        <p className={styles.whyUs}>
          Родное QR-меню в Poster — бесплатное, но на вопрос про аллергены оно не отвечает.
          Сегодня в каталоге Poster нет ни одного приложения, которое берёт это на себя за вас.
        </p>
        <a className={styles.cta} href="/api/oauth/start">
          Подключить заведение
        </a>
      </section>

      <footer className={styles.footer}>
        <a className={styles.adminLink} href="/admin">
          Вход для администратора
        </a>
      </footer>
    </div>
  );
}
