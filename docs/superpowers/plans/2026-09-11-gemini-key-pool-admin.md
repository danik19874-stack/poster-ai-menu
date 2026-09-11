# Gemini Key Pool + Admin Panel (Plan 2a of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the infrastructure the real AI chat (Plan 2 proper) will run
on: a pool of free-tier Gemini API keys with per-key daily-quota tracking
and automatic fallback to the next key, a minimal password-gated `/admin`
panel to add/disable keys and see today's usage, and an activity log so the
owner can see real install/usage numbers instead of guessing. The AI chat
itself (system prompt, structured menu context, hallucination guardrails)
is a separate follow-up plan and is out of scope here — this plan has no
LLM call in it at all, only the key-selection plumbing a future chat
endpoint will call.

**Why this shape (owner decisions, 11.09.2026):** Verified against Gemini's
own rate-limit docs that free-tier quota is per Google Cloud **project**,
not per API key — creating multiple keys in one project does not multiply
quota, and creating throwaway projects specifically to dodge the limit
violates Google's terms of service. So "add more keys" here means the
owner provisions additional real, separate Gemini projects as usage
genuinely grows (each with its own quota), and this pool picks whichever
currently has budget left — not a workaround, just routing across
legitimately separate resources. Owner explicitly declined building a
paid-tier switch-over now ("зачем платить за то что и так бесплатно") —
this plan only pools free keys; moving any one of them to Gemini's paid
tier later is a config change on Google's side, not a code change here.

**Architecture:** Same conventions as the rest of the project — plain
TypeScript modules under `lib/` with dependency-injected collaborators
(matching `lib/orders/createTableOrder.ts`) for anything worth unit
testing, thin Next.js route/page wiring for everything else. Admin auth is
a single shared password (owner is the only admin today) verified against
`ADMIN_PASSWORD`, with a signed, expiring cookie using Node's built-in
`crypto` HMAC — no new npm dependency for auth. The admin panel itself is
plain server-rendered HTML forms (POST + redirect), no client-side
JavaScript, matching the minimalism already used elsewhere in this project
and needing no new dependency.

**New environment variable:** `ADMIN_PASSWORD` — owner picks a value and
adds it to `.env.local` before Task 3. Also doubles as the HMAC signing
secret for the session cookie (fine for a single-owner admin gate; not
meant to scale to multi-admin roles later).

**Known, accepted limitation (documented, not fixed here):** `recordKeyUsage`
does a read-then-write increment, not an atomic SQL increment — a real
race condition under concurrent requests. At current and near-term traffic
(one owner testing, a handful of real restaurants) this is not a real risk;
revisit with a Postgres RPC (`requests_today = requests_today + 1`) if
concurrent AI traffic ever becomes significant.

**Tech Stack:** unchanged — Next.js App Router (TypeScript), Supabase
Postgres (service-role, server-only), Vitest, Node's built-in `crypto`.

---

## Task 1: Schema — Gemini key pool and activity log

**Files:**
- Create: `supabase/migrations/20260911020000_add_gemini_keys_and_activity_log.sql`

- [ ] **Step 1: Write and apply the migration**

Create `supabase/migrations/20260911020000_add_gemini_keys_and_activity_log.sql`:

```sql
-- Pool of free-tier Gemini API keys the (future) AI chat endpoint rotates
-- across. Free-tier quota is per Google Cloud project, not per key — each
-- row here represents a real, separate project's key, not a way to dodge
-- one project's limit. Plaintext api_key is the same accepted-for-now risk
-- already documented for restaurants.poster_token; same fix (Supabase
-- Vault) applies before a real paying customer, not before MVP testing.
create table gemini_api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  api_key text not null,
  daily_limit integer not null default 1500,
  requests_today integer not null default 0,
  usage_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Minimal usage log so the admin panel can show real numbers ("how many
-- restaurants actually used this in the last 30 days") instead of just
-- "how many ever connected". kind='order' is logged starting in Task 5 of
-- this plan; kind='ai_query' will start being logged once the real AI chat
-- endpoint (a separate, later plan) exists — it's an accepted, expected
-- gap that ai_query rows are zero until then, not a bug in this plan.
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  kind text not null check (kind in ('order', 'ai_query')),
  created_at timestamptz not null default now()
);

create index activity_log_restaurant_id_idx on activity_log(restaurant_id);
create index activity_log_created_at_idx on activity_log(created_at);
```

Apply it via the Supabase Management API, same method used for every prior
migration in this project (`POST https://api.supabase.com/v1/projects/edgaiwacueuxzlkwoxqv/database/query`
with the Management API personal access token). Verify with:

```sql
select table_name from information_schema.tables
where table_name in ('gemini_api_keys', 'activity_log');
```

Expected: both rows returned.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260911020000_add_gemini_keys_and_activity_log.sql
git commit -m "feat: add schema for the Gemini key pool and an activity log"
```

---

## Task 2: Key pool selection logic (pure, dependency-injected)

**Files:**
- Create: `lib/gemini/keyPool.ts`
- Create: `lib/gemini/keyPool.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/gemini/keyPool.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { pickAvailableKey, recordKeyUsage } from './keyPool';
import type { GeminiKey } from './keyPool';

const TODAY = '2026-09-11';

function makeKey(overrides: Partial<GeminiKey> = {}): GeminiKey {
  return {
    id: 'key-1',
    apiKey: 'secret-1',
    dailyLimit: 1500,
    requestsToday: 0,
    usageDate: TODAY,
    ...overrides,
  };
}

describe('pickAvailableKey', () => {
  it('returns the first active key that still has budget today', async () => {
    const keys = [makeKey({ id: 'a', requestsToday: 10 }), makeKey({ id: 'b' })];
    const deps = { getActiveKeys: vi.fn().mockResolvedValue(keys), resetDailyUsage: vi.fn() };

    const picked = await pickAvailableKey(deps, TODAY);

    expect(picked?.id).toBe('a');
  });

  it('skips an exhausted key and returns the next one with budget', async () => {
    const keys = [
      makeKey({ id: 'a', requestsToday: 1500, dailyLimit: 1500 }),
      makeKey({ id: 'b', requestsToday: 3, dailyLimit: 1500 }),
    ];
    const deps = { getActiveKeys: vi.fn().mockResolvedValue(keys), resetDailyUsage: vi.fn() };

    const picked = await pickAvailableKey(deps, TODAY);

    expect(picked?.id).toBe('b');
  });

  it('returns null when every key is exhausted', async () => {
    const keys = [makeKey({ id: 'a', requestsToday: 1500, dailyLimit: 1500 })];
    const deps = { getActiveKeys: vi.fn().mockResolvedValue(keys), resetDailyUsage: vi.fn() };

    const picked = await pickAvailableKey(deps, TODAY);

    expect(picked).toBeNull();
  });

  it('treats a key from a previous day as reset to 0 and calls resetDailyUsage', async () => {
    const keys = [makeKey({ id: 'a', requestsToday: 1500, dailyLimit: 1500, usageDate: '2026-09-10' })];
    const resetDailyUsage = vi.fn().mockResolvedValue(undefined);
    const deps = { getActiveKeys: vi.fn().mockResolvedValue(keys), resetDailyUsage };

    const picked = await pickAvailableKey(deps, TODAY);

    expect(picked).toEqual({ id: 'a', apiKey: 'secret-1', dailyLimit: 1500, requestsToday: 0, usageDate: TODAY });
    expect(resetDailyUsage).toHaveBeenCalledWith('a');
  });

  it('returns null when there are no active keys at all', async () => {
    const deps = { getActiveKeys: vi.fn().mockResolvedValue([]), resetDailyUsage: vi.fn() };

    expect(await pickAvailableKey(deps, TODAY)).toBeNull();
  });
});

describe('recordKeyUsage', () => {
  it('increments requestsToday by 1 relative to the given key state', async () => {
    const incrementUsage = vi.fn().mockResolvedValue(undefined);

    await recordKeyUsage({ incrementUsage }, makeKey({ id: 'a', requestsToday: 4 }));

    expect(incrementUsage).toHaveBeenCalledWith('a', 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/gemini/keyPool.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `keyPool`**

Create `lib/gemini/keyPool.ts`:

```typescript
export interface GeminiKey {
  id: string;
  apiKey: string;
  dailyLimit: number;
  requestsToday: number;
  /** ISO date string, e.g. "2026-09-11" — the day requestsToday counts against. */
  usageDate: string;
}

interface PickDeps {
  /** Must already be filtered to is_active = true — this function doesn't re-check activeness. */
  getActiveKeys: () => Promise<GeminiKey[]>;
  resetDailyUsage: (keyId: string) => Promise<void>;
}

interface RecordDeps {
  incrementUsage: (keyId: string, requestsToday: number) => Promise<void>;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function pickAvailableKey(
  deps: PickDeps,
  today: string = todayUtc(),
): Promise<GeminiKey | null> {
  const keys = await deps.getActiveKeys();

  for (const key of keys) {
    let requestsToday = key.requestsToday;
    let usageDate = key.usageDate;

    if (usageDate !== today) {
      await deps.resetDailyUsage(key.id);
      requestsToday = 0;
      usageDate = today;
    }

    if (requestsToday < key.dailyLimit) {
      return { ...key, requestsToday, usageDate };
    }
  }

  return null;
}

export async function recordKeyUsage(deps: RecordDeps, key: GeminiKey): Promise<void> {
  await deps.incrementUsage(key.id, key.requestsToday + 1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/gemini/keyPool.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add lib/gemini/keyPool.ts lib/gemini/keyPool.test.ts
git commit -m "feat: add pure, dependency-injected Gemini key pool selection logic"
```

---

## Task 3: Admin session auth (password + signed cookie)

**Files:**
- Create: `lib/admin/session.ts`
- Create: `lib/admin/session.test.ts`
- Create: `proxy.ts`

**Verified against this project's installed Next.js version (16.3.4,
checked live in `node_modules/next/dist/docs/` per this project's own
"not the Next.js you know" rule, not assumed from training data):**
`middleware.ts` is deprecated in Next 16, renamed to `proxy.ts` with an
exported function named `proxy` (or default export) instead of
`middleware`. Proxy defaults to the Node.js runtime (not the restricted
Edge runtime older Next versions used), so Node's built-in `crypto` module
used in `lib/admin/session.ts` works without any extra config.

- [ ] **Step 1: Write the failing tests**

Create `lib/admin/session.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPassword, createSessionToken, verifySessionToken } from './session';

describe('admin session', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', 'correct-horse-battery-staple');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('checkPassword', () => {
    it('accepts the correct password', () => {
      expect(checkPassword('correct-horse-battery-staple')).toBe(true);
    });

    it('rejects an incorrect password', () => {
      expect(checkPassword('wrong')).toBe(false);
    });
  });

  describe('createSessionToken / verifySessionToken', () => {
    it('verifies a freshly created token', () => {
      expect(verifySessionToken(createSessionToken())).toBe(true);
    });

    it('rejects a tampered signature', () => {
      const token = createSessionToken();
      const [expiresAt] = token.split('.');
      expect(verifySessionToken(`${expiresAt}.deadbeef`)).toBe(false);
    });

    it('rejects an expired token', () => {
      const expiredExpiresAt = Date.now() - 1000;
      const tokenWithPastExpiry = `${expiredExpiresAt}.anything`;
      expect(verifySessionToken(tokenWithPastExpiry)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(verifySessionToken(undefined)).toBe(false);
    });

    it('rejects a malformed token with no signature part', () => {
      expect(verifySessionToken('not-a-real-token')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/admin/session.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `session`**

Create `lib/admin/session.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('Missing required environment variable: ADMIN_PASSWORD');
  }
  return password;
}

function sign(payload: string): string {
  return createHmac('sha256', getPassword()).update(payload).digest('hex');
}

export function checkPassword(candidate: string): boolean {
  return candidate === getPassword();
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  return `${expiresAt}.${sign(String(expiresAt))}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const [expiresAtStr, signature] = token.split('.');
  if (!expiresAtStr || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = sign(expiresAtStr);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;

  return timingSafeEqual(provided, expectedBuf);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/admin/session.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 5: Add the proxy (Next 16's replacement for middleware)**

Create `proxy.ts` (project root, next to `package.json` — NOT `middleware.ts`,
which Next.js 16 deprecated in favor of this file):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin/session';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

- [ ] **Step 6: Add `ADMIN_PASSWORD` to `.env.local`**

The owner adds a real value to `.env.local` (not committed):

```
ADMIN_PASSWORD=<a real password the owner picks>
```

- [ ] **Step 7: Commit**

```bash
git add lib/admin/session.ts lib/admin/session.test.ts proxy.ts
git commit -m "feat: add password-gated admin session auth (signed cookie, no new dependency)"
```

---

## Task 4: Login page and route

**Files:**
- Create: `app/api/admin/login/route.ts`
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/login/login.module.css`

No new unit tests — this is thin route/page wiring around Task 3's
already-tested `session.ts`. Verified manually in Task 6.

- [ ] **Step 1: Implement the login route**

Create `app/api/admin/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, createSessionToken } from '@/lib/admin/session';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get('password') ?? '');

  if (!checkPassword(password)) {
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), 303);
  }

  const response = NextResponse.redirect(new URL('/admin', request.url), 303);
  response.cookies.set('admin_session', createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
```

- [ ] **Step 2: Implement the login page**

Create `app/admin/login/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Add the styles**

Create `app/admin/login/login.module.css`:

```css
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--background);
}

.card {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px;
}

.input {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 14px;
  background: var(--background);
  color: var(--foreground);
}

.button {
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 14px;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
}

.error {
  font-size: 13px;
  color: #dc2626;
  margin: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/login app/admin/login
git commit -m "feat: add admin login page and route"
```

---

## Task 5: Admin dashboard — keys table, add/toggle, activity summary

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/admin.module.css`
- Create: `app/api/admin/keys/route.ts`
- Create: `app/api/admin/keys/[id]/toggle/route.ts`
- Create: `app/api/admin/logout/route.ts`

No new unit tests — thin CRUD wiring, verified manually in Task 6.

- [ ] **Step 1: Implement the dashboard page**

Create `app/admin/page.tsx`:

```tsx
import { getSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./admin.module.css";

export default async function AdminDashboard() {
  const supabase = getSupabaseServerClient();

  const { count: totalRestaurants } = await supabase
    .from("restaurants")
    .select("*", { count: "exact", head: true });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentActivity } = await supabase
    .from("activity_log")
    .select("restaurant_id")
    .gte("created_at", thirtyDaysAgo);
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
    .select("id, label, daily_limit, requests_today, usage_date, is_active")
    .order("created_at", { ascending: true });

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

      <h2 className={styles.sectionTitle}>Ключи Gemini</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Название</th>
            <th>Использовано сегодня</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(keys ?? []).map((key) => {
            const usedToday = key.usage_date === today ? key.requests_today : 0;
            return (
              <tr key={key.id}>
                <td>{key.label}</td>
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
              </tr>
            );
          })}
          {(keys ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className={styles.empty}>
                Ключей пока нет — добавьте первый ниже.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className={styles.sectionTitle}>Добавить ключ</h2>
      <form className={styles.addForm} method="POST" action="/api/admin/keys">
        <input className={styles.input} name="label" placeholder="Название (например, «ключ 2»)" required />
        <input className={styles.input} name="api_key" placeholder="Значение ключа" required />
        <input className={styles.input} name="daily_limit" type="number" placeholder="Дневной лимит (по умолчанию 1500)" />
        <button className={styles.button} type="submit">
          Добавить
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Implement the add-key route**

Create `app/api/admin/keys/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const label = String(formData.get('label') ?? '').trim();
  const apiKey = String(formData.get('api_key') ?? '').trim();
  const dailyLimitRaw = Number(formData.get('daily_limit'));
  const dailyLimit = Number.isFinite(dailyLimitRaw) && dailyLimitRaw > 0 ? dailyLimitRaw : 1500;

  if (!label || !apiKey) {
    return NextResponse.redirect(new URL('/admin?error=missing_fields', request.url), 303);
  }

  const supabase = getSupabaseServerClient();
  await supabase.from('gemini_api_keys').insert({ label, api_key: apiKey, daily_limit: dailyLimit });

  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
```

- [ ] **Step 3: Implement the toggle route**

Create `app/api/admin/keys/[id]/toggle/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data } = await supabase.from('gemini_api_keys').select('is_active').eq('id', id).single();
  if (data) {
    await supabase.from('gemini_api_keys').update({ is_active: !data.is_active }).eq('id', id);
  }

  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
```

- [ ] **Step 4: Implement the logout route**

Create `app/api/admin/logout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/admin/login', request.url), 303);
  response.cookies.delete('admin_session');
  return response;
}
```

- [ ] **Step 5: Add the dashboard styles**

Create `app/admin/admin.module.css`:

```css
.page {
  min-height: 100vh;
  background: var(--background);
  padding: 24px 28px 60px;
  max-width: 900px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.logoutButton {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}

.statsRow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}

.stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.statValue {
  font-variant-numeric: tabular-nums;
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
}

.statLabel {
  font-size: 12.5px;
  color: var(--ink-soft);
  margin: 0;
}

.sectionTitle {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 12px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 32px;
}

.table th,
.table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.table th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

.empty {
  color: var(--ink-soft);
  text-align: center;
}

.toggleButton {
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 12.5px;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.addForm {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.input {
  flex: 1;
  min-width: 160px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  background: var(--surface);
  color: var(--foreground);
}

.button {
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 14px;
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
}
```

- [ ] **Step 6: Commit**

```bash
git add app/admin app/api/admin
git commit -m "feat: add admin dashboard (Gemini key management, install/activity summary)"
```

---

## Task 6: Log real orders into `activity_log`

**Files:**
- Modify: `app/api/orders/route.ts`

No new unit tests — one additional side effect in an already-tested route;
`createTableOrder`'s own tests are untouched. Verified manually in the
final verification pass.

- [ ] **Step 1: Insert an activity_log row after a successful order**

In `app/api/orders/route.ts`, after the existing `const result = await createTableOrder(...)` call succeeds and before `return NextResponse.json(result, ...)`, add:

```typescript
    try {
      await supabase.from('activity_log').insert({ restaurant_id: restaurantId, kind: 'order' });
    } catch (logError) {
      // Analytics logging must never fail an order that already succeeded in Poster.
      console.error('Failed to record activity_log for order:', logError);
    }
```

(`supabase` and `restaurantId` are already in scope at that point in the
existing function — no new imports needed.)

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all existing tests still pass (this route has no dedicated unit
test file today, per the existing codebase — `createTableOrder.test.ts`
covers the underlying logic and is untouched).

- [ ] **Step 3: Commit**

```bash
git add app/api/orders/route.ts
git commit -m "feat: log real guest orders into activity_log for the admin summary"
```

---

## Verification

- `npx vitest run` — all tests green, including the new `keyPool` and
  `session` suites, no regressions.
- `npx tsc --noEmit` and `npx eslint app lib` clean.
- Manual browser walkthrough:
  1. Add `ADMIN_PASSWORD=<value>` to `.env.local`, restart the dev server.
  2. Visit `/admin` with no cookie → redirected to `/admin/login`.
  3. Submit the wrong password → stays on login with an error shown.
  4. Submit the right password → redirected to `/admin`, cookie set.
  5. Add a real key (label + a dummy or real Gemini key value + leave
     daily limit blank) → appears in the table as `0 / 1500`, `включён`.
  6. Click "Выключить" → status flips to `выключен`; click again to
     re-enable.
  7. `curl -i -X POST http://localhost:3000/api/admin/keys` with no
     cookie → `401`.
  8. Place one real test order through the already-working guest flow
     (`/menu-preview/{restaurantId}?table=7`) → reload `/admin` → "Заказов
     сегодня" incremented by 1, "Активны за 30 дней" includes that
     restaurant.
  9. Click "Выйти" → redirected to login, `/admin` now redirects again.
- Dated note in `CLAUDE.md` after the manual walkthrough passes, per this
  project's established practice for guest/owner-facing flows.
