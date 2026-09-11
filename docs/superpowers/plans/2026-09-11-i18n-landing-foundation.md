# i18n Foundation (next-intl) + Landing ru/en Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up `next-intl` for the whole App Router, restructure routes under `app/[locale]/...`, and translate the public landing page (`app/page.tsx`) into Russian (default) and English — without breaking `/admin`, `/api/**`, or the existing guest widget URLs (`/menu-preview/{restaurantId}?table=N`, which real printed QR codes already point to).

**Architecture:** `next-intl` v4 with `localePrefix: 'as-needed'` (Russian stays unprefixed at the current URLs, English gets an `/en` prefix). Because `next-intl` requires page routes to live under a `[locale]` dynamic segment, and our project already has its own `proxy.ts` (Next.js 16's renamed `middleware.ts`) guarding `/admin`, this plan merges `next-intl`'s middleware into that same file rather than replacing it. Because removing the single shared `app/layout.tsx` is required to give `[locale]` pages their own `<html lang>`, `/admin` gets its own independent root layout — this is an officially supported Next.js pattern ("multiple root layouts"), not a workaround.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19, `next-intl` 4.14.4, `next/root-params` (native to Next 16.3+), Vitest.

**Scope guardrail:** This plan does **not** translate `app/menu-preview/**` content (only relocates the files) and does **not** add kk/es/uk or touch AI prompts. Those are separate future plans.

---

## Verified facts (do not re-derive, do not re-guess)

These were confirmed by installing the real package and reading its actual `.d.ts` files and the real Next.js 16 docs bundled in `node_modules/next/dist/docs/` — not from memory or a library's marketing docs:

1. **`next-intl@4.14.4` is installed.** `defineRouting`, `createNavigation`, `createMiddleware` (default export from `next-intl/middleware`), `getRequestConfig`/`getTranslations`/`getLocale`/`setRequestLocale` (from `next-intl/server`), and `hasLocale` (from the main `next-intl` package, re-exported from `use-intl/core`) all exist exactly as used below.
2. **`GetRequestConfigParams.requestLocale` is deprecated** in favor of `next/root-params` (confirmed in `node_modules/next-intl/dist/types/server/react-server/getRequestConfig.d.ts`). This plan uses `next/root-params`, not the deprecated `requestLocale`.
3. **`next/root-params` is native to Next.js 16.3+** (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-root-params.md`, version history table shows `v16.3.0`). Our `package.json` has `"next": "16.3.4"` — no experimental flag needed. Root parameter getter names come from the dynamic segment folder name, so the folder **must** be named `app/[locale]` for `import { locale } from 'next/root-params'` to exist.
4. **A `proxy.ts`/`middleware.ts` file may export its function as a named `proxy` export or a default export — Next.js accepts either — but only ONE proxy per project** (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`: *"multiple proxy from the same file are not supported"*). Our existing `proxy.ts` uses a named export; `next-intl`'s `createMiddleware(routing)` returns a plain `(request) => NextResponse` function. This plan calls that function *from inside* our existing `proxy` function — it does not create a second file.
5. **"Any layout without a `layout.js` above it is a root layout"** and root layouts "can be under a dynamic segment... Dynamic segments before the root layout are root parameters" (confirmed verbatim in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`, lines 142–146). This is exactly our situation once `app/layout.tsx` is removed: `app/[locale]/layout.tsx` and `app/admin/layout.tsx` each become independent root layouts. `app/api/**` route handlers need no layout at all.
6. **`localePrefix: 'as-needed'`** keeps the default locale (`ru`) unprefixed — `/menu-preview/...` keeps resolving exactly as it does today. Only `en` gets an `/en/...` prefix.
7. All four internal navigation links inside the guest widget (`CartBar.tsx`, `cart/page.tsx`, `[itemId]/page.tsx`, `page.tsx`) build plain absolute path strings like `` `/menu-preview/${restaurantId}` `` — none of them use `next-intl`'s `Link`. Confirmed via grep. They need **zero code changes**, only physical relocation.
8. `tsconfig.json` maps `@/*` to the project root (not `./app/*`), so moving files deeper under `app/[locale]/...` does not break any `@/lib/...` import.
9. `app/globals.css` sets `body { font-family: var(--font-geist-sans), ... }`. That CSS variable is currently only defined via the `className` on `<html>` in the single `app/layout.tsx`. Once there are two independent root layouts, both need that same class — handled here by extracting the font instances into one shared `lib/fonts.ts` module (calling a `next/font/google` loader once in one file and importing the resulting object elsewhere is an explicitly supported pattern — the compiler tracks the *call site*, not every place the result is used).

---

## File Structure

**Create:**
- `i18n/routing.ts` — locale list + prefix strategy (single source of truth for locales)
- `i18n/routing.test.ts` — locales/defaultLocale sanity test
- `i18n/request.ts` — per-request locale + messages resolution for Server Components
- `i18n/navigation.ts` — locale-aware `Link`/`usePathname` re-exports
- `messages/ru.json`, `messages/en.json` — landing page copy, one JSON tree each
- `messages/messages.test.ts` — asserts both files have identical key shapes (catches missing translations at test time, not in production)
- `lib/fonts.ts` — the two `next/font/google` instances, shared by both root layouts
- `lib/routing/shouldSkipIntl.ts` — pure function: does this pathname belong to the admin subtree (and therefore skip `next-intl`)?
- `lib/routing/shouldSkipIntl.test.ts`
- `app/[locale]/layout.tsx` — new root layout for the marketing site + widget
- `app/[locale]/page.tsx`, `app/[locale]/page.module.css` — moved + translated landing page
- `app/[locale]/LanguageSwitcher.tsx` — small client component, RU/EN links
- `app/admin/layout.tsx` — new, independent root layout for `/admin` (plain Russian, no `next-intl`)
- `app/[locale]/menu-preview/**` — the 11 existing files, moved as-is (`git mv`, no content changes)

**Modify:**
- `next.config.ts` — wrap with `createNextIntlPlugin()`
- `proxy.ts` — merge `shouldSkipIntl` + `next-intl`'s middleware into the existing admin-auth function
- `CLAUDE.md` — dated manual-verification note (project convention)

**Delete:**
- `app/layout.tsx` (replaced by the two independent root layouts above)
- `app/page.tsx`, `app/page.module.css` (moved to `app/[locale]/`)
- `app/menu-preview/**` (moved to `app/[locale]/menu-preview/**`)

---

### Task 1: Install next-intl

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)

- [ ] **Step 1: Install the package**

Run: `npm install next-intl`

- [ ] **Step 2: Verify the version and that the build still works untouched**

Run: `cat node_modules/next-intl/package.json | grep '"version"'`
Expected: `"version": "4.14.4"` (or newer 4.x — if it's a different major version, stop and re-verify the APIs in this plan against the real `.d.ts` files before continuing, since this whole plan was written against 4.14.4's actual exports)

Run: `npx tsc --noEmit && npx vitest run`
Expected: same pass/fail state as before this task (no app code changed yet)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install next-intl"
```

---

### Task 2: Routing configuration

**Files:**
- Create: `i18n/routing.ts`
- Create: `i18n/routing.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// i18n/routing.test.ts
import { describe, expect, it } from 'vitest';
import { routing } from './routing';

describe('i18n routing config', () => {
  it('has ru as the default locale', () => {
    expect(routing.defaultLocale).toBe('ru');
  });

  it('supports exactly ru and en for now', () => {
    expect(routing.locales).toEqual(['ru', 'en']);
  });

  it('does not prefix the default locale in the URL', () => {
    expect(routing.localePrefix).toBe('as-needed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run i18n/routing.test.ts`
Expected: FAIL with "Cannot find module './routing'"

- [ ] **Step 3: Write the implementation**

```typescript
// i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ru', 'en'],
  defaultLocale: 'ru',
  localePrefix: 'as-needed',
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run i18n/routing.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add i18n/routing.ts i18n/routing.test.ts
git commit -m "feat(i18n): add next-intl routing config (ru default, en)"
```

---

### Task 3: Message catalogs (ru + en)

**Files:**
- Create: `messages/ru.json`
- Create: `messages/en.json`
- Create: `messages/messages.test.ts`

This task only creates the JSON files and a structural test. Nothing in the app reads them yet (that's Task 8) — so there is no way to "run the app and see it" for this task; the test is what proves correctness.

**Context on tone:** every string below already went through a deliberate marketing-psychology pass with the project owner (loss aversion in the hero subtitle, "honesty as differentiator" in the AI-officiant feature, anchoring + mental accounting in pricing, regret aversion in the final CTA). The English versions are **not** literal translations — they carry the same psychological technique in natural English. Do not "improve" or paraphrase further without checking with the owner; do not translate word-for-word if you're asked to add more locales later.

**Known gotcha:** the Russian price string currently uses HTML entity `&nbsp;` inside JSX text (`3&nbsp;890&nbsp;₸`), which JSX decodes automatically. A JSON string interpolated via `{t('key')}` is **plain text** — the literal characters `&nbsp;` would render on screen instead of a space. Both JSON files below use a real Unicode non-breaking space character (U+00A0) in that string instead. When editing this file later, be careful not to let an editor "helpfully" replace it with a regular space.

- [ ] **Step 1: Write `messages/ru.json`**

```json
{
  "Header": {
    "brandSub": "Виджет для Joinposter",
    "navFeatures": "Возможности",
    "navHow": "Как это работает",
    "navBenefits": "Преимущества",
    "navPricing": "Тарифы",
    "cta": "Подключить"
  },
  "Hero": {
    "eyebrow": "Виджет для Joinposter",
    "titleLine1": "НеЖди — заказывай, узнавай,",
    "titleAccent": "наслаждайся",
    "subtitle": "Пока гость ждёт официанта, чтобы спросить про орехи в соусе — он мог бы уже сделать заказ. НеЖди отвечает и принимает заказ сам, пока вы заняты залом.",
    "ctaPrimary": "Подключить виджет →",
    "ctaSecondary": "Как это работает",
    "note": "$15/мес после пробного периода · 14 дней бесплатно",
    "phoneDishName": "Боул с лососем",
    "phoneDishPrice": "3 890 ₸",
    "tagComposition": "Состав",
    "tagCalories": "Калории",
    "tagRecommended": "Рекомендовано",
    "orderBtn": "Заказать",
    "bubbleText": "Это блюдо — лёгкий боул с лососем, свежими овощами и авторским соусом. Идеально для обеда!"
  },
  "Features": {
    "label": "Возможности",
    "title": "Всё, что нужно для удобного заказа",
    "item1Title": "Заказ без ожидания официанта",
    "item1Badge": "Главное",
    "item1Text": "Гость видит меню, выбирает блюдо и оформляет заказ сам — прямо со своего телефона, не ловя официанта в разгар смены.",
    "item2Title": "Честный ИИ-официант",
    "item2Text": "Отвечает по составу из вашей кассы. Не знает — так и скажет «уточните у официанта», а не придумает.",
    "item3Title": "Меню без рассинхрона",
    "item3Text": "Поменяли цену или стоп-лист на кассе — гость увидел это в ту же секунду.",
    "item4Title": "Рекомендации, а не просто список",
    "item4Text": "ИИ подскажет блюдо в тему заказа — как хороший официант, но всегда, а не когда есть время."
  },
  "HowItWorks": {
    "label": "Как это работает",
    "title": "Просто. Удобно. Для всех.",
    "step1Title": "Гость открывает меню",
    "step1Text": "Сканирует QR на столе — попадает прямо в меню заведения.",
    "step2Title": "Выбирает блюда и спрашивает у ИИ",
    "step2Text": "Узнаёт состав, калории, аллергены и оформляет заказ сам.",
    "step3Title": "Получает заказ без ожидания",
    "step3Text": "Заказ мгновенно на кассе — официант подтверждает одним тапом.",
    "step4Title": "Без ожидания официанта",
    "step4Text": "Без лишних движений — для гостя и для персонала.",
    "mockDish1": "Паста карбонара",
    "mockDish2": "Боул с лососем",
    "mockDish3": "Цезарь с креветками",
    "mockPhoneBrand": "НеЖди",
    "mockAiLabel": "ИИ-официант",
    "mockChatQuestion": "Есть аллергены?",
    "mockChatReply": "В составе сливки, бекон и пармезан. Без орехов и глютена."
  },
  "Benefits": {
    "label": "Почему это выгодно",
    "title": "Современный сервис, который работает на ваш бизнес",
    "photoText1": "Быстро.",
    "photoText2": "Удобно.",
    "photoText3": "Современно.",
    "item1Title": "Гость не рискует здоровьем",
    "item1Text": "Честный ответ про аллерген вместо «наверное, орехов нет» от официанта, который не готовил блюдо сам.",
    "item2Title": "Выше средний чек",
    "item2Text": "ИИ ненавязчиво рекомендует к заказу — то же допродажа, что делает хороший официант, но без пропусков.",
    "item3Title": "Официант — не справочник по составу",
    "item3Text": "Рутинные вопросы про аллергены уходят к ИИ, персонал занят гостями, которым правда нужна помощь.",
    "item4Title": "Подключение за пару минут",
    "item4Text": "Через Poster, без интеграторов и технической настройки с вашей стороны."
  },
  "Pricing": {
    "label": "Тарифы",
    "title": "Один тариф. Без скрытых условий.",
    "price": "$15",
    "pricePeriod": "/мес",
    "priceSub": "≈ $0.5 в день — меньше чашки кофе",
    "trial": "Первые 14 дней бесплатно",
    "item1": "ИИ-консультант по составу и аллергенам — без лимита на вопросы",
    "item2": "Приём заказа с QR прямо на кассу Poster",
    "item3": "Меню синхронизировано с кассой автоматически",
    "item4": "Один тариф без ступеней и доплат за рост",
    "cta": "Подключить виджет →",
    "anchor": "Дешевле, чем платный QR-виджет и ИИ-инструмент по отдельности"
  },
  "CtaBanner": {
    "brandName": "НеЖди",
    "brandSub": "Умный виджет для Joinposter",
    "title": "Попробуйте без риска",
    "text": "14 дней бесплатно. Не подошло — отключите в один клик, ничего не платите.",
    "cta": "Подключить в Joinposter →",
    "note": "$15/мес после пробного периода"
  },
  "Footer": {
    "brandName": "НеЖди",
    "brandSub": "Виджет для Joinposter",
    "admin": "Вход для администратора"
  },
  "Metadata": {
    "title": "ИИ-меню для Poster POS",
    "description": "Гостевое меню по QR-коду с ИИ-консультантом по составу блюд."
  }
}
```

- [ ] **Step 2: Write `messages/en.json`**

```json
{
  "Header": {
    "brandSub": "Widget for Joinposter",
    "navFeatures": "Features",
    "navHow": "How it works",
    "navBenefits": "Benefits",
    "navPricing": "Pricing",
    "cta": "Connect"
  },
  "Hero": {
    "eyebrow": "Widget for Joinposter",
    "titleLine1": "NeZhdi — order, ask,",
    "titleAccent": "enjoy",
    "subtitle": "While the guest waits to ask if the sauce has nuts in it, they could already have placed the order. NeZhdi answers questions and takes the order itself, while you focus on the floor.",
    "ctaPrimary": "Connect the widget →",
    "ctaSecondary": "How it works",
    "note": "$15/mo after the trial · 14 days free",
    "phoneDishName": "Salmon Bowl",
    "phoneDishPrice": "3 890 ₸",
    "tagComposition": "Ingredients",
    "tagCalories": "Calories",
    "tagRecommended": "Recommended",
    "orderBtn": "Order",
    "bubbleText": "This dish is a light salmon bowl with fresh vegetables and our signature sauce. Perfect for lunch!"
  },
  "Features": {
    "label": "Features",
    "title": "Everything you need for effortless ordering",
    "item1Title": "No more waiting for the waiter",
    "item1Badge": "Key feature",
    "item1Text": "The guest sees the menu, picks a dish, and places the order themselves — right from their phone, without chasing a waiter mid-shift.",
    "item2Title": "Honest AI waiter",
    "item2Text": "Answers from your POS data. Doesn't know something? It says so — \"please check with your server\" — instead of making it up.",
    "item3Title": "A menu that's never out of sync",
    "item3Text": "Change a price or 86 a dish at the register — the guest sees it the very same second.",
    "item4Title": "Recommendations, not just a list",
    "item4Text": "The AI suggests a fitting dish for the order — like a good waiter, but every time, not only when there's time."
  },
  "HowItWorks": {
    "label": "How it works",
    "title": "Simple. Convenient. For everyone.",
    "step1Title": "Guest opens the menu",
    "step1Text": "Scans the QR code on the table — lands straight in the venue's menu.",
    "step2Title": "Picks dishes and asks the AI",
    "step2Text": "Finds out about ingredients, calories, and allergens, then places the order themselves.",
    "step3Title": "Gets the order without waiting",
    "step3Text": "The order appears on the register instantly — the waiter confirms it with one tap.",
    "step4Title": "No waiting for the waiter",
    "step4Text": "No extra hassle — for the guest or for the staff.",
    "mockDish1": "Carbonara Pasta",
    "mockDish2": "Salmon Bowl",
    "mockDish3": "Caesar with Shrimp",
    "mockPhoneBrand": "NeZhdi",
    "mockAiLabel": "AI waiter",
    "mockChatQuestion": "Any allergens?",
    "mockChatReply": "Contains cream, bacon, and parmesan. No nuts or gluten."
  },
  "Benefits": {
    "label": "Why it pays off",
    "title": "A modern service that works for your business",
    "photoText1": "Fast.",
    "photoText2": "Convenient.",
    "photoText3": "Modern.",
    "item1Title": "Guests don't gamble with their health",
    "item1Text": "An honest answer about allergens beats a \"probably no nuts\" from a waiter who didn't cook the dish.",
    "item2Title": "Higher average check",
    "item2Text": "The AI gently recommends add-ons — the same upselling a good waiter does, minus the missed opportunities.",
    "item3Title": "Your waiter isn't a walking ingredient list",
    "item3Text": "Routine allergen questions go to the AI, freeing staff for guests who actually need help.",
    "item4Title": "Set up in a couple of minutes",
    "item4Text": "Through Poster, no integrators or technical setup on your end."
  },
  "Pricing": {
    "label": "Pricing",
    "title": "One plan. No hidden terms.",
    "price": "$15",
    "pricePeriod": "/mo",
    "priceSub": "≈ $0.5 a day — less than a cup of coffee",
    "trial": "First 14 days free",
    "item1": "AI consultant on ingredients and allergens — unlimited questions",
    "item2": "Order taking via QR straight to your Poster register",
    "item3": "Menu synced with your register automatically",
    "item4": "One flat plan, no tiers or growth surcharges",
    "cta": "Connect the widget →",
    "anchor": "Cheaper than a paid QR widget and an AI tool bought separately"
  },
  "CtaBanner": {
    "brandName": "NeZhdi",
    "brandSub": "Smart widget for Joinposter",
    "title": "Try it risk-free",
    "text": "14 days free. Doesn't fit? Turn it off in one click, pay nothing.",
    "cta": "Connect in Joinposter →",
    "note": "$15/mo after the trial"
  },
  "Footer": {
    "brandName": "NeZhdi",
    "brandSub": "Widget for Joinposter",
    "admin": "Admin sign-in"
  },
  "Metadata": {
    "title": "AI menu widget for Poster POS",
    "description": "Guest menu via QR code with an AI consultant on dish ingredients."
  }
}
```

- [ ] **Step 3: Write the failing test**

```typescript
// messages/messages.test.ts
import { describe, expect, it } from 'vitest';
import ru from './ru.json';
import en from './en.json';

function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeyPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('message catalogs', () => {
  it('ru and en expose exactly the same set of keys', () => {
    const ruKeys = collectKeyPaths(ru).sort();
    const enKeys = collectKeyPaths(en).sort();
    expect(enKeys).toEqual(ruKeys);
  });

  it('has no empty string values in either catalog', () => {
    const emptyRu = collectKeyPaths(ru).filter((path) => {
      const value = path.split('.').reduce((o: any, k) => o?.[k], ru);
      return value === '';
    });
    const emptyEn = collectKeyPaths(en).filter((path) => {
      const value = path.split('.').reduce((o: any, k) => o?.[k], en);
      return value === '';
    });
    expect(emptyRu).toEqual([]);
    expect(emptyEn).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run messages/messages.test.ts`
Expected: PASS (2/2) — if it fails on the key-parity test, the diff output tells you exactly which key exists in one file but not the other; fix the JSON, don't fix the test.

- [ ] **Step 5: Commit**

```bash
git add messages/ru.json messages/en.json messages/messages.test.ts
git commit -m "feat(i18n): add ru/en landing page message catalogs"
```

---

### Task 4: Request config + navigation helpers

**Files:**
- Create: `i18n/request.ts`
- Create: `i18n/navigation.ts`

Neither file is wired into the app yet — this task only proves they compile against the routing config from Task 2 and the message catalogs from Task 3.

- [ ] **Step 1: Write `i18n/request.ts`**

```typescript
// i18n/request.ts
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';
import { notFound } from 'next/navigation';
import { routing } from './routing';

export default getRequestConfig(async () => {
  const candidate = await rootLocale();

  if (!hasLocale(routing.locales, candidate)) {
    notFound();
  }

  return {
    locale: candidate,
    messages: (await import(`../messages/${candidate}.json`)).default,
  };
});
```

- [ ] **Step 2: Write `i18n/navigation.ts`**

```typescript
// i18n/navigation.ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, usePathname, useRouter, redirect, getPathname } = createNavigation(routing);
```

- [ ] **Step 3: Verify both files compile**

Run: `npx tsc --noEmit`
Expected: no new errors from `i18n/request.ts` or `i18n/navigation.ts` (there will still be no errors overall, since nothing imports these two files yet)

- [ ] **Step 4: Commit**

```bash
git add i18n/request.ts i18n/navigation.ts
git commit -m "feat(i18n): add request config and navigation helpers"
```

---

### Task 5: Wire the next-intl plugin into next.config.ts

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Read the current file**

Current content of `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

- [ ] **Step 2: Wrap it with the next-intl plugin**

```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 3: Verify the app still builds**

Run: `npx tsc --noEmit`
Expected: no errors (the plugin looks for `./i18n/request.ts` by default, which exists as of Task 4, but nothing renders through it yet, so there's nothing to break)

Run: `npx vitest run`
Expected: all tests from Tasks 2–4 still pass

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(i18n): wire next-intl plugin into next.config.ts"
```

---

### Task 6: Shared font module

**Files:**
- Create: `lib/fonts.ts`
- Modify: `app/layout.tsx:1-13` (import from the new shared module instead of calling the font loaders directly)

This task changes *where* the font instances are created, but not their configuration — `app/layout.tsx` still renders exactly as before. This keeps the single-root-layout app in a fully working state one task before it gets split in Task 8.

- [ ] **Step 1: Write `lib/fonts.ts`**

```typescript
// lib/fonts.ts
import { Geist, Geist_Mono } from "next/font/google";

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

- [ ] **Step 2: Update `app/layout.tsx` to use it**

Full new content of `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { geistSans, geistMono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "ИИ-меню для Poster POS",
  description: "Гостевое меню по QR-коду с ИИ-консультантом по составу блюд.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify nothing changed visually**

Run: `npx tsc --noEmit && npx eslint app lib`
Expected: no errors

Run the dev server (`npm run dev`) and open `http://localhost:3000/` — it must look byte-for-byte identical to before this task (same fonts, same metadata). This is a pure refactor.

- [ ] **Step 4: Commit**

```bash
git add lib/fonts.ts app/layout.tsx
git commit -m "refactor: extract shared font instances to lib/fonts.ts"
```

---

### Task 7: Pure routing-decision helper for the proxy

**Files:**
- Create: `lib/routing/shouldSkipIntl.ts`
- Create: `lib/routing/shouldSkipIntl.test.ts`

This is the one piece of the eventual `proxy.ts` merge that's worth unit testing on its own — `proxy.ts` itself is a Next.js file convention that isn't easily unit-testable without a real request/response cycle (it gets a manual browser check in Task 8 instead).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/routing/shouldSkipIntl.test.ts
import { describe, expect, it } from 'vitest';
import { shouldSkipIntl } from './shouldSkipIntl';

describe('shouldSkipIntl', () => {
  it('skips /admin pages', () => {
    expect(shouldSkipIntl('/admin')).toBe(true);
    expect(shouldSkipIntl('/admin/login')).toBe(true);
  });

  it('skips /api/admin routes', () => {
    expect(shouldSkipIntl('/api/admin/keys')).toBe(true);
  });

  it('does not skip other /api routes (they are excluded by the proxy matcher instead)', () => {
    expect(shouldSkipIntl('/api/orders')).toBe(false);
  });

  it('does not skip the landing page or the guest widget', () => {
    expect(shouldSkipIntl('/')).toBe(false);
    expect(shouldSkipIntl('/en')).toBe(false);
    expect(shouldSkipIntl('/menu-preview/abc-123')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/routing/shouldSkipIntl.test.ts`
Expected: FAIL with "Cannot find module './shouldSkipIntl'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/routing/shouldSkipIntl.ts
export function shouldSkipIntl(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/routing/shouldSkipIntl.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add lib/routing/shouldSkipIntl.ts lib/routing/shouldSkipIntl.test.ts
git commit -m "feat(i18n): add pure helper to route admin paths around next-intl"
```

---

### Task 8: The route restructure (the one big atomic task)

**Why this task can't be split further:** Next.js resolves routes from the file system. `app/page.tsx` and `app/[locale]/page.tsx` cannot both exist while both are able to resolve `/` — and `app/[locale]/layout.tsx` cannot render `<html lang={locale}>` while `app/layout.tsx` still exists and also renders `<html>` (two nested `<html>` tags is a hard error). Every file below has to move together for the app to build at any point past this task's first step. Work through the steps in order; don't run `tsc`/tests until the final step.

**Files:**
- Delete: `app/layout.tsx`
- Move: `app/page.tsx` → `app/[locale]/page.tsx` (content rewritten)
- Move: `app/page.module.css` → `app/[locale]/page.module.css` (content unchanged)
- Move: `app/menu-preview/**` (all 11 files) → `app/[locale]/menu-preview/**` (content unchanged)
- Create: `app/[locale]/layout.tsx`
- Create: `app/admin/layout.tsx`
- Create: `app/[locale]/LanguageSwitcher.tsx`
- Modify: `proxy.ts`

- [ ] **Step 1: Move the guest widget (pure relocation, preserves git history)**

```bash
mkdir -p "app/[locale]"
git mv "app/menu-preview" "app/[locale]/menu-preview"
```

Verify nothing inside changed: `git status` should show renames, not modifications, for all 11 files.

- [ ] **Step 2: Move the landing page files**

```bash
git mv app/page.tsx "app/[locale]/page.tsx"
git mv app/page.module.css "app/[locale]/page.module.css"
```

- [ ] **Step 3: Delete the old shared root layout**

```bash
git rm app/layout.tsx
```

- [ ] **Step 4: Create the new admin root layout**

`/admin` is not localized — this is a plain, independent root layout, no `next-intl` involved.

```typescript
// app/admin/layout.tsx
import type { Metadata } from "next";
import { geistSans, geistMono } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Админка · НеЖди",
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create the new `[locale]` root layout**

```typescript
// app/[locale]/layout.tsx
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { geistSans, geistMono } from "@/lib/fonts";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleRootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Rewrite `app/[locale]/page.tsx` to pull text from translations**

Full new content:

```typescript
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
              НеЖди
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
```

Note: `app/[locale]/page.module.css` needs no changes — none of its class names changed.

Note: the hero's phone mockup header intentionally reuses `tHow("mockPhoneBrand")` (from the `HowItWorks` namespace) instead of duplicating a separate `Hero.phoneBrand` key — both phone mockups show the same "НеЖди"/"NeZhdi" wordmark, so one shared key avoids two copies that could drift out of sync. This is deliberate, not a leftover — don't "fix" it into two keys.

- [ ] **Step 7: Create the language switcher**

Do not hand-construct the `href` for each locale (e.g. `` `/${locale}${pathname}` ``) — that produces a wrong, doubly-prefixed or wrongly-unprefixed URL depending on `localePrefix: 'as-needed'` and which locale is active. Use `next-intl`'s own `Link` with a `locale` prop instead — it already knows the routing strategy from Task 2 and builds the correct URL for every locale, including the unprefixed default:

```typescript
// app/[locale]/LanguageSwitcher.tsx
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
            color: "inherit",
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
```

`usePathname` from `@/i18n/navigation` already strips the locale prefix, and `Link`'s `href={pathname}` + `locale={locale}` prop re-adds the correct prefix (or no prefix, for `ru`) automatically — this is exactly what `createNavigation` exists for, per `node_modules/next-intl/dist/types/navigation/react-client/createNavigation.d.ts`, which types `Link`'s props to accept a `locale` override.

- [ ] **Step 8: Merge next-intl's middleware into the existing proxy.ts**

Full new content of `proxy.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { verifySessionToken } from '@/lib/admin/session';
import { shouldSkipIntl } from '@/lib/routing/shouldSkipIntl';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipIntl(pathname)) {
    if (pathname === '/admin/login' || pathname === '/api/admin/login') {
      return NextResponse.next();
    }

    const token = request.cookies.get('admin_session')?.value;
    if (!verifySessionToken(token)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

The matcher is the union of the two things this proxy now handles: the existing admin paths (unchanged), plus `next-intl`'s recommended pattern for everything else (excluding `/api`, Next.js internals, and files with a dot in the name, e.g. `favicon.ico`).

- [ ] **Step 9: Verify the whole app builds and typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. If you see an error about `LayoutProps<"/[locale]">` or `LayoutProps<"/admin">` not existing yet, run `npm run dev` once and stop it (Next.js generates these route-aware types on first `dev`/`build`) — this project already relies on this pattern elsewhere (e.g. `LayoutProps<"/">` was used in the old `app/layout.tsx`).

Run: `npx eslint app lib i18n`
Expected: no errors (warnings about `<img>` are pre-existing and expected, same as before this plan)

Run: `npx vitest run`
Expected: all tests pass, including the ones from Tasks 2, 3, and 7

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(i18n): restructure routes under app/[locale], split root layouts, wire proxy"
```

---

### Task 9: Manual verification (do not skip — green tests are not proof this works in a browser)

This project's own `CLAUDE.md` has a standing precedent: every previous plan (guest ordering, admin panel, AI chat) was manually verified in a real browser after tests passed, because tests don't catch routing/layout mistakes like the ones this plan is most at risk of. Use `dev-browser` (already set up in this project) for all of the following. Start the dev server first: `npm run dev`.

- [ ] **Step 1: Russian landing loads unprefixed**

Open `http://localhost:3000/`. Confirm:
- Every piece of text from the previous (pre-i18n) version is still there and unchanged, in Russian.
- The URL bar still shows `/` — no `/ru` prefix appeared.
- Take a screenshot and compare it side-by-side with the landing page before this plan (visually identical is the bar — this plan changes zero copy, only its source).

- [ ] **Step 2: English landing loads under /en**

Open `http://localhost:3000/en`. Confirm:
- All text is in English, matches `messages/en.json`.
- Nothing reads as a literal translation that lost the persuasion techniques (spot-check the hero subtitle and the pricing anchor line against the Russian version's intent).

- [ ] **Step 3: Language switcher actually switches**

From `/`, click "EN" in the header. Confirm the URL becomes `/en` and the content changes to English. From `/en`, click "RU". Confirm the URL goes back to `/` (not `/ru`) and content is Russian again.

- [ ] **Step 4: The existing guest widget URL still works — this is the regression test that matters most**

Get a real `restaurant_id` from Supabase (one already exists from earlier sessions in this project):

```bash
curl -s "https://edgaiwacueuxzlkwoxqv.supabase.co/rest/v1/restaurants?select=id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Open `http://localhost:3000/menu-preview/{that-id}?table=1` (no locale prefix). Confirm:
- The menu loads exactly as before (categories, items, photos).
- Adding an item to the cart still works.
- Opening a dish detail page and asking the AI a question still works (if a real Gemini key is configured in `/admin`; if not, confirm the "service overloaded" fallback still triggers correctly rather than crashing).
- Going to checkout (`/cart`) and back still works.

- [ ] **Step 5: /admin and OAuth are unaffected**

Open `http://localhost:3000/admin`. Confirm it still redirects to `/admin/login` when logged out, and that logging in with the real admin password still works and shows the dashboard.

Open `http://localhost:3000/api/oauth/start`. Confirm it still redirects into Poster's OAuth flow (a 302 to `joinposter.com/...`) rather than 404ing or getting caught by the locale middleware.

- [ ] **Step 6: Record the verification in CLAUDE.md**

Add a new dated paragraph to `CLAUDE.md` (following the existing style of the two entries already there), stating what was manually verified and the date, plus the one non-obvious fact worth remembering for next time: that `/admin` and the `[locale]` tree are now two independent root layouts (not one shared layout), so any future shared UI between them needs to be a component imported into both, not something added to a single root layout.

- [ ] **Step 7: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: record manual verification of i18n foundation"
```

---

## What's explicitly out of scope (do not do this in this plan)

- Translating `app/[locale]/menu-preview/**` content (guest-facing widget stays Russian-only for now)
- Adding `kk`, `es`, or `uk` locales
- Any change to the AI system prompt or the `mentioned_ingredients` hallucination check for multi-language support
- Any change to the marketplace listing description text in Poster's dev console
