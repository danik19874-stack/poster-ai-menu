import { getTranslations } from "next-intl/server";
import styles from "./page.module.css";
import LanguageSwitcher from "./LanguageSwitcher";

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

export default async function Home() {
  const tHeader = await getTranslations("Header");
  const tHero = await getTranslations("Hero");
  const tFeatures = await getTranslations("Features");
  const tHow = await getTranslations("HowItWorks");
  const tBenefits = await getTranslations("Benefits");
  const tPricing = await getTranslations("Pricing");
  const tCtaBanner = await getTranslations("CtaBanner");
  const tFooter = await getTranslations("Footer");

  const navLinks = [
    { href: "#features", label: tHeader("navFeatures") },
    { href: "#how", label: tHeader("navHow") },
    { href: "#benefits", label: tHeader("navBenefits") },
    { href: "#pricing", label: tHeader("navPricing") },
  ];

  const features = [
    {
      icon: "bolt",
      title: tFeatures("item1Title"),
      badge: tFeatures("item1Badge"),
      text: tFeatures("item1Text"),
      highlight: true,
    },
    { icon: "chat", title: tFeatures("item2Title"), text: tFeatures("item2Text") },
    { icon: "star", title: tFeatures("item3Title"), text: tFeatures("item3Text") },
    { icon: "chart", title: tFeatures("item4Title"), text: tFeatures("item4Text") },
  ];

  const steps = [
    { n: "01", title: tHow("step1Title"), text: tHow("step1Text") },
    { n: "02", title: tHow("step2Title"), text: tHow("step2Text") },
    { n: "03", title: tHow("step3Title"), text: tHow("step3Text") },
  ];

  const benefits = [
    { title: tBenefits("item1Title"), text: tBenefits("item1Text") },
    { title: tBenefits("item2Title"), text: tBenefits("item2Text") },
    { title: tBenefits("item3Title"), text: tBenefits("item3Text") },
    { title: tBenefits("item4Title"), text: tBenefits("item4Text") },
  ];
  const benefitIcons = ["guests", "trend", "hands", "plug"];

  const pricingItems = [
    tPricing("item1"),
    tPricing("item2"),
    tPricing("item3"),
    tPricing("item4"),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="#" className={styles.brand}>
            <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.brandMark} />
            <span className={styles.brandText}>
              {tHeader("brandName")}
              <span className={styles.brandSub}>{tHeader("brandSub")}</span>
            </span>
          </a>
          <nav className={styles.nav}>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <LanguageSwitcher />
          <a className={styles.headerCta} href="/api/oauth/start">
            {tHeader("cta")}
          </a>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroBackdrop} aria-hidden="true" />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{tHero("eyebrow")}</span>
            <h1 className={styles.title}>
              {tHero("titleLine1")}
              <br />
              <span className={styles.titleAccent}>{tHero("titleAccent")}</span>
            </h1>
            <p className={styles.subtitle}>{tHero("subtitle")}</p>
            <div className={styles.heroActions}>
              <a className={styles.ctaPrimary} href="/api/oauth/start">
                {tHero("ctaPrimary")}
              </a>
              <a className={styles.ctaSecondary} href="#how">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7-11-7Z" />
                </svg>
                {tHero("ctaSecondary")}
              </a>
            </div>
            <p className={styles.heroNote}>{tHero("note")}</p>
          </div>

          <div className={styles.heroMockWrap}>
            <div className={styles.phone}>
              <div className={styles.phoneNotch} />
              <div className={styles.phoneScreen}>
                <div className={styles.phoneHeader}>
                  <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.phoneHeaderMark} />
                  <span>{tHow("mockPhoneBrand")}</span>
                </div>
                <div
                  className={styles.phoneDish}
                  style={{ backgroundImage: "url(https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&q=70&w=700&auto=format&fit=crop)" }}
                />
                <div className={styles.phoneDishName}>{tHero("phoneDishName")}</div>
                <div className={styles.phoneDishPrice}>{tHero("phoneDishPrice")}</div>
                <div className={styles.phoneTags}>
                  <span>{tHero("tagComposition")}</span>
                  <span>{tHero("tagCalories")}</span>
                  <span>{tHero("tagRecommended")}</span>
                </div>
                <div className={styles.phoneOrderBtn}>{tHero("orderBtn")}</div>
              </div>
            </div>

            <div className={styles.heroBubble}>
              <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.bubbleAvatar} />
              <p>{tHero("bubbleText")}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>{tFeatures("label")}</p>
          <h2 className={styles.sectionTitle}>{tFeatures("title")}</h2>
          <div className={styles.featureGrid}>
            {features.map((f) => (
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
              <p className={styles.sectionLabel}>{tHow("label")}</p>
              <h2 className={styles.sectionTitle}>{tHow("title")}</h2>
              <ol className={styles.stepList}>
                {steps.map((s) => (
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
                    <p className={styles.stepTitle}>{tHow("step4Title")}</p>
                    <p className={styles.stepText}>{tHow("step4Text")}</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.stackWrap}>
              <div className={`${styles.phone} ${styles.phoneStack1}`}>
                <div className={styles.phoneNotch} />
                <div className={styles.phoneScreenSm}>
                  <div className={styles.miniRow}>{tHow("mockDish1")}</div>
                  <div className={styles.miniRow}>{tHow("mockDish2")}</div>
                  <div className={styles.miniRow}>{tHow("mockDish3")}</div>
                </div>
              </div>
              <div className={`${styles.phone} ${styles.phoneStack2}`}>
                <div className={styles.phoneNotch} />
                <div className={styles.phoneScreenSm}>
                  <div className={styles.phoneHeader}>
                    <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.phoneHeaderMark} />
                    <span>{tHow("mockPhoneBrand")}</span>
                  </div>
                  <div
                    className={styles.phoneDish}
                    style={{ backgroundImage: "url(https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&q=70&w=700&auto=format&fit=crop)" }}
                  />
                  <div className={styles.phoneDishName}>{tHow("mockDish2")}</div>
                </div>
              </div>
              <div className={`${styles.phone} ${styles.phoneStack3}`}>
                <div className={styles.phoneNotch} />
                <div className={styles.phoneScreenSm}>
                  <div className={styles.phoneHeader}>
                    <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.phoneHeaderMark} />
                    <span>{tHow("mockAiLabel")}</span>
                  </div>
                  <div className={styles.miniChat}>{tHow("mockChatQuestion")}</div>
                  <div className={styles.miniChatReply}>{tHow("mockChatReply")}</div>
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
                {tBenefits("photoText1")}
                <br />
                {tBenefits("photoText2")}
                <br />
                {tBenefits("photoText3")}
              </p>
            </div>
            <div className={styles.benefitsCopy}>
              <p className={styles.sectionLabel}>{tBenefits("label")}</p>
              <h2 className={styles.sectionTitle}>{tBenefits("title")}</h2>
              <div className={styles.benefitList}>
                {benefits.map((b, i) => (
                  <div key={b.title} className={styles.benefitItem}>
                    <div className={styles.benefitIcon}>
                      <Icon name={benefitIcons[i]} />
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
            {tPricing("label")}
          </p>
          <h2 className={styles.sectionTitle} style={{ textAlign: "center" }}>
            {tPricing("title")}
          </h2>
          <div className={styles.pricingCard}>
            <p className={styles.pricingPrice}>
              {tPricing("price")}
              <span>{tPricing("pricePeriod")}</span>
            </p>
            <p className={styles.pricingSub}>{tPricing("priceSub")}</p>
            <p className={styles.pricingTrial}>{tPricing("trial")}</p>
            <ul className={styles.pricingList}>
              {pricingItems.map((item) => (
                <li key={item}>
                  <Icon name="check" />
                  {item}
                </li>
              ))}
            </ul>
            <a className={styles.ctaPrimary} href="/api/oauth/start">
              {tPricing("cta")}
            </a>
            <p className={styles.pricingAnchor}>{tPricing("anchor")}</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.ctaBanner}>
            <div className={styles.ctaBannerBrand}>
              <img src="/brand/icon-nezhdi-mascot-mark-1024.png" alt="" className={styles.ctaBannerMark} />
              <div>
                <p className={styles.ctaBannerName}>{tCtaBanner("brandName")}</p>
                <p className={styles.ctaBannerSub}>{tCtaBanner("brandSub")}</p>
              </div>
            </div>
            <div className={styles.ctaBannerCopy}>
              <p className={styles.ctaBannerTitle}>{tCtaBanner("title")}</p>
              <p className={styles.ctaBannerText}>{tCtaBanner("text")}</p>
            </div>
            <div className={styles.ctaBannerAction}>
              <a className={styles.ctaDark} href="/api/oauth/start">
                {tCtaBanner("cta")}
              </a>
              <p className={styles.ctaBannerNote}>{tCtaBanner("note")}</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <p className={styles.brandText} style={{ color: "var(--lp-light-ink)" }}>
              {tFooter("brandName")}
            </p>
            <p className={styles.footerSub}>{tFooter("brandSub")}</p>
          </div>
          <nav className={styles.footerNav}>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <a className={styles.footerAdmin} href="/admin">
            {tFooter("admin")}
          </a>
        </div>
      </footer>
    </div>
  );
}
