import styles from "./page.module.css";

const NAV_LINKS = [
  { href: "#features", label: "Возможности" },
  { href: "#how", label: "Как это работает" },
  { href: "#benefits", label: "Преимущества" },
  { href: "#pricing", label: "Тарифы" },
];

const FEATURES = [
  {
    icon: "bolt",
    title: "Заказ без ожидания официанта",
    badge: "Главное",
    text: "Гость видит меню, выбирает блюдо и оформляет заказ сам — прямо со своего телефона, не ловя официанта в разгар смены.",
    highlight: true,
  },
  {
    icon: "chat",
    title: "Честный ИИ-официант",
    text: "Отвечает по составу из вашей кассы. Не знает — так и скажет «уточните у официанта», а не придумает.",
  },
  {
    icon: "star",
    title: "Меню без рассинхрона",
    text: "Поменяли цену или стоп-лист на кассе — гость увидел это в ту же секунду.",
  },
  {
    icon: "chart",
    title: "Рекомендации, а не просто список",
    text: "ИИ подскажет блюдо в тему заказа — как хороший официант, но всегда, а не когда есть время.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Гость открывает меню",
    text: "Сканирует QR на столе — попадает прямо в меню заведения.",
  },
  {
    n: "02",
    title: "Выбирает блюда и спрашивает у ИИ",
    text: "Узнаёт состав, калории, аллергены и оформляет заказ сам.",
  },
  {
    n: "03",
    title: "Получает заказ без ожидания",
    text: "Заказ мгновенно на кассе — официант подтверждает одним тапом.",
  },
];

const BENEFITS = [
  {
    title: "Гость не рискует здоровьем",
    text: "Честный ответ про аллерген вместо «наверное, орехов нет» от официанта, который не готовил блюдо сам.",
  },
  {
    title: "Выше средний чек",
    text: "ИИ ненавязчиво рекомендует к заказу — то же допродажа, что делает хороший официант, но без пропусков.",
  },
  {
    title: "Официант — не справочник по составу",
    text: "Рутинные вопросы про аллергены уходят к ИИ, персонал занят гостями, которым правда нужна помощь.",
  },
  {
    title: "Подключение за пару минут",
    text: "Через Poster, без интеграторов и технической настройки с вашей стороны.",
  },
];

function Icon({ name }: { name: string }) {
  switch (name) {
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 5h16v11H9l-4 4V16H4V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="9" cy="10.5" r="1" fill="currentColor" />
          <circle cx="12" cy="10.5" r="1" fill="currentColor" />
          <circle cx="15" cy="10.5" r="1" fill="currentColor" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3 14.5 9 21 9.7 16.2 14 17.6 20.5 12 17.2 6.4 20.5 7.8 14 3 9.7 9.5 9 12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "guests":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21c-3-3-8-6-8-11a4 4 0 0 1 7-2.6A4 4 0 0 1 18 10c0 5-5 8-6 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "trend":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 16 10 10 14 14 20 6M20 6h-5M20 6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "hands":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 12V6a2 2 0 1 1 4 0v5M10 11V4a2 2 0 1 1 4 0v7M14 11V6a2 2 0 1 1 4 0v7c0 4-2 7-6 7s-6-2-7-5l-1.5-3.5A1.6 1.6 0 0 1 4.6 9.4c1-.6 2 0 2.4 1L8 13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "plug":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

const BENEFIT_ICONS = ["guests", "trend", "hands", "plug"];

const PRICING_ITEMS = [
  "ИИ-консультант по составу и аллергенам — без лимита на вопросы",
  "Приём заказа с QR прямо на кассу Poster",
  "Меню синхронизировано с кассой автоматически",
  "Один тариф без ступеней и доплат за рост",
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="#" className={styles.brand}>
            <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.brandMark} />
            <span className={styles.brandText}>
              НеЖди
              <span className={styles.brandSub}>Виджет для Joinposter</span>
            </span>
          </a>
          <nav className={styles.nav}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <a className={styles.headerCta} href="/api/oauth/start">
            Подключить
          </a>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroBackdrop} aria-hidden="true" />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Виджет для Joinposter</span>
            <h1 className={styles.title}>
              НеЖди — заказывай, узнавай,
              <br />
              <span className={styles.titleAccent}>наслаждайся</span>
            </h1>
            <p className={styles.subtitle}>
              Пока гость ждёт официанта, чтобы спросить про орехи в соусе — он мог бы уже
              сделать заказ. НеЖди отвечает и принимает заказ сам, пока вы заняты залом.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.ctaPrimary} href="/api/oauth/start">
                Подключить виджет →
              </a>
              <a className={styles.ctaSecondary} href="#how">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7-11-7Z" />
                </svg>
                Как это работает
              </a>
            </div>
            <p className={styles.heroNote}>$15/мес после пробного периода · 14 дней бесплатно</p>
          </div>

          <div className={styles.heroMockWrap}>
            <div className={styles.phone}>
              <div className={styles.phoneNotch} />
              <div className={styles.phoneScreen}>
                <div className={styles.phoneHeader}>
                  <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.phoneHeaderMark} />
                  <span>НеЖди</span>
                </div>
                <div
                  className={styles.phoneDish}
                  style={{ backgroundImage: "url(https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&q=70&w=700&auto=format&fit=crop)" }}
                />
                <div className={styles.phoneDishName}>Боул с лососем</div>
                <div className={styles.phoneDishPrice}>3&nbsp;890&nbsp;₸</div>
                <div className={styles.phoneTags}>
                  <span>Состав</span>
                  <span>Калории</span>
                  <span>Рекомендовано</span>
                </div>
                <div className={styles.phoneOrderBtn}>Заказать</div>
              </div>
            </div>

            <div className={styles.heroBubble}>
              <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.bubbleAvatar} />
              <p>Это блюдо — лёгкий боул с лососем, свежими овощами и авторским соусом. Идеально для обеда!</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>Возможности</p>
          <h2 className={styles.sectionTitle}>Всё, что нужно для удобного заказа</h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={f.highlight ? `${styles.featureCard} ${styles.featureCardHighlight}` : styles.featureCard}
              >
                {f.badge && <span className={styles.featureBadge}>{f.badge}</span>}
                <div className={styles.featureIcon}>
                  <Icon name={f.icon} />
                </div>
                <p className={styles.featureTitle}>{f.title}</p>
                <p className={styles.featureText}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className={`${styles.section} ${styles.sectionMuted}`}>
        <div className={styles.sectionInner}>
          <div className={styles.howGrid}>
            <div className={styles.howCopy}>
              <p className={styles.sectionLabel}>Как это работает</p>
              <h2 className={styles.sectionTitle}>Просто. Удобно. Для всех.</h2>
              <ol className={styles.stepList}>
                {STEPS.map((s) => (
                  <li key={s.n}>
                    <span className={styles.stepNum}>{s.n}</span>
                    <div>
                      <p className={styles.stepTitle}>{s.title}</p>
                      <p className={styles.stepText}>{s.text}</p>
                    </div>
                  </li>
                ))}
                <li>
                  <span className={styles.stepCheck}>
                    <Icon name="check" />
                  </span>
                  <div>
                    <p className={styles.stepTitle}>Без ожидания официанта</p>
                    <p className={styles.stepText}>Без лишних движений — для гостя и для персонала.</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.stackWrap}>
              <div className={`${styles.phone} ${styles.phoneStack1}`}>
                <div className={styles.phoneNotch} />
                <div className={styles.phoneScreenSm}>
                  <div className={styles.miniRow}>Паста карбонара</div>
                  <div className={styles.miniRow}>Боул с лососем</div>
                  <div className={styles.miniRow}>Цезарь с креветками</div>
                </div>
              </div>
              <div className={`${styles.phone} ${styles.phoneStack2}`}>
                <div className={styles.phoneNotch} />
                <div className={styles.phoneScreenSm}>
                  <div className={styles.phoneHeader}>
                    <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.phoneHeaderMark} />
                    <span>НеЖди</span>
                  </div>
                  <div
                    className={styles.phoneDish}
                    style={{ backgroundImage: "url(https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&q=70&w=700&auto=format&fit=crop)" }}
                  />
                  <div className={styles.phoneDishName}>Боул с лососем</div>
                </div>
              </div>
              <div className={`${styles.phone} ${styles.phoneStack3}`}>
                <div className={styles.phoneNotch} />
                <div className={styles.phoneScreenSm}>
                  <div className={styles.phoneHeader}>
                    <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.phoneHeaderMark} />
                    <span>ИИ-официант</span>
                  </div>
                  <div className={styles.miniChat}>Есть аллергены?</div>
                  <div className={styles.miniChatReply}>
                    В составе сливки, бекон и пармезан. Без орехов и глютена.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.benefitsGrid}>
            <div
              className={styles.benefitsPhoto}
              style={{ backgroundImage: "url(https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?fm=jpg&q=70&w=900&auto=format&fit=crop)" }}
            >
              <p>
                Быстро.
                <br />
                Удобно.
                <br />
                Современно.
              </p>
            </div>
            <div className={styles.benefitsCopy}>
              <p className={styles.sectionLabel}>Почему это выгодно</p>
              <h2 className={styles.sectionTitle}>Современный сервис, который работает на ваш бизнес</h2>
              <div className={styles.benefitList}>
                {BENEFITS.map((b, i) => (
                  <div key={b.title} className={styles.benefitItem}>
                    <div className={styles.benefitIcon}>
                      <Icon name={BENEFIT_ICONS[i]} />
                    </div>
                    <div>
                      <p className={styles.benefitTitle}>{b.title}</p>
                      <p className={styles.benefitText}>{b.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className={`${styles.section} ${styles.sectionMuted}`}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel} style={{ textAlign: "center" }}>
            Тарифы
          </p>
          <h2 className={styles.sectionTitle} style={{ textAlign: "center" }}>
            Один тариф. Без скрытых условий.
          </h2>
          <div className={styles.pricingCard}>
            <p className={styles.pricingPrice}>
              $15<span>/мес</span>
            </p>
            <p className={styles.pricingSub}>≈ $0.5 в день — меньше чашки кофе</p>
            <p className={styles.pricingTrial}>Первые 14 дней бесплатно</p>
            <ul className={styles.pricingList}>
              {PRICING_ITEMS.map((item) => (
                <li key={item}>
                  <Icon name="check" />
                  {item}
                </li>
              ))}
            </ul>
            <a className={styles.ctaPrimary} href="/api/oauth/start">
              Подключить виджет →
            </a>
            <p className={styles.pricingAnchor}>
              Дешевле, чем платный QR-виджет и ИИ-инструмент по отдельности
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.ctaBanner}>
            <div className={styles.ctaBannerBrand}>
              <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.ctaBannerMark} />
              <div>
                <p className={styles.ctaBannerName}>НеЖди</p>
                <p className={styles.ctaBannerSub}>Умный виджет для Joinposter</p>
              </div>
            </div>
            <div className={styles.ctaBannerCopy}>
              <p className={styles.ctaBannerTitle}>Попробуйте без риска</p>
              <p className={styles.ctaBannerText}>14 дней бесплатно. Не подошло — отключите в один клик, ничего не платите.</p>
            </div>
            <div className={styles.ctaBannerAction}>
              <a className={styles.ctaDark} href="/api/oauth/start">
                Подключить в Joinposter →
              </a>
              <p className={styles.ctaBannerNote}>$15/мес после пробного периода</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <p className={styles.brandText} style={{ color: "var(--lp-light-ink)" }}>
              НеЖди
            </p>
            <p className={styles.footerSub}>Виджет для Joinposter</p>
          </div>
          <nav className={styles.footerNav}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <a className={styles.footerAdmin} href="/admin">
            Вход для администратора
          </a>
        </div>
      </footer>
    </div>
  );
}
