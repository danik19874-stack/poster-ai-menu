"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  ru: "RU",
  en: "EN",
};

export default function LanguageSwitcher() {
  const activeLocale = useLocale();
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === activeLocale ? "true" : undefined}
          style={{
            fontSize: 13,
            textDecoration: "none",
            // `inherit` resolves to the near-black --lp-light-ink here, which is
            // invisible against the dark header. Use the header's own ink token.
            color: "var(--lp-ink, inherit)",
            opacity: locale === activeLocale ? 1 : 0.55,
            fontWeight: locale === activeLocale ? 700 : 500,
          }}
        >
          {LOCALE_LABELS[locale]}
        </Link>
      ))}
    </div>
  );
}
