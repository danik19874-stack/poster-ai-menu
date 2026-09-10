# Poster API Integration — Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational backend layer that talks to Poster POS —
fetch menu/ingredients, cache them, compute ingredient-completeness, and
submit a guest order for staff to accept at the register — with no UI and
no AI chat yet. Everything else in the spec (guest chat, AI guardrails,
onboarding checker UI, marketplace listing copy) is a separate follow-up
plan and depends on this one working and tested first.

**Architecture:** A Next.js (App Router, TypeScript) app with server-only
API routes. A thin, fully-typed Poster API client wraps the relevant
endpoints (`menu.getProducts`, `incomingOrders.createIncomingOrder`). A
Supabase Postgres database caches each restaurant's menu server-side so the
(future) guest-facing chat never calls Poster directly per request. All
Poster tokens and Supabase service-role access stay server-side; the guest
browser only ever talks to our own Next.js API.

**Revision note (10.09.2026):** Task 3 originally used `POST /api/orders`
with `tableId`+`autoAccept: true` (fully automatic, no staff confirmation).
Switched to `incomingOrders.createIncomingOrder` — the method Poster's own
integration guidelines document for third-party/marketplace order
submission — after finding the guidelines explicitly point there, and after
the owner confirmed staff confirmation at the register is a deliberate,
wanted quality gate, not a limitation to route around. This changes the
order flow (staff taps to accept before anything reaches the kitchen), the
table reference (free-text `comment`, not a structured `tableId`), and adds
a phone/`client_id` requirement not present in the old method (see the
design spec's Architecture section for the placeholder-phone decision).
Task 3 below reflects the corrected approach; the original `POST /api/orders`
code that was already built is being replaced, not kept alongside it.

**Tech Stack:** Next.js (App Router, TypeScript; Task 1 used
`create-next-app@latest`, which resolved to Next 16.3.4 — treat any
App Router specifics in later tasks as targeting that version, not 14)
· Supabase (Postgres, service-role client, server-only) · Vitest for tests
· plain `fetch` for the Poster API (no SDK exists for it).

**Why this stack (owner didn't specify one):** Supabase matches what the
owner's other project (Lumio/BuildBoard) already uses, so there's a working
mental model and no new vendor to learn. Next.js API routes are enough —
this backend is simple CRUD + two outbound HTTP calls, not complex enough
to justify a separate service. Vitest is the standard test runner for this
stack and has first-class `vi.fn()`/`vi.stubGlobal` support for mocking
`fetch`, which every test below needs.

---

## Scope note

The spec's MVP also includes: AI chat with guardrails (Plan 2), the guest
ordering UI + table QR generation (Plan 3), and the onboarding-completeness
UI + marketplace listing copy using the psychology-driven positioning from
the spec (Plan 4, uses the `copywriting` skill to turn the spec's
positioning section into final card/UI text). This plan only covers the
Poster-facing backend plumbing all three depend on.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts` (via scaffold command)
- Create: `.env.local.example`
- Create: `vitest.config.ts`

- [ ] **Step 1: Scaffold the Next.js app**

Run:
```bash
npx create-next-app@latest . --typescript --app --no-tailwind --eslint --src-dir=false --import-alias "@/*"
```

- [ ] **Step 2: Install Supabase client and test tooling**

Run:
```bash
npm install @supabase/supabase-js
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 3: Add the Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Add a test script to package.json**

Modify `package.json` — add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 5: Document required environment variables**

Create `.env.local.example`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Note: Poster access tokens are per-restaurant and live in the `restaurants`
table (Task 4), not in env vars — this app serves many restaurants, each
with their own Poster token.

- [ ] **Step 6: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js + Vitest project"
```

---

### Task 2: Poster API types

**Files:**
- Create: `lib/poster/types.ts`

- [ ] **Step 1: Write the shared Poster API types**

Create `lib/poster/types.ts`:
```typescript
export interface PosterIngredientRef {
  name: string;
}

export interface PosterProduct {
  productId: number;
  name: string;
  description: string;
  price: number;
  ingredients: PosterIngredientRef[] | null;
  inStopList: boolean;
}

export interface CreateOrderItem {
  productId: number;
  count: number;
  modificatorId?: number;
}

export interface CreateOrderRequest {
  spotId: number;
  tableId: number;
  serviceMode: 1 | 2 | 3;
  autoAccept: boolean;
  products: CreateOrderItem[];
}

export interface CreateOrderResponse {
  response: {
    id: number;
    status: number;
    spotId: number;
    tableId: number;
  };
}

export class PosterApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PosterApiError';
  }
}
```

This task has no test on its own — it's pure type declarations, exercised
by the tests in Task 3.

- [ ] **Step 2: Commit**

```bash
git add lib/poster/types.ts
git commit -m "feat: add Poster API type definitions"
```

---

### Task 3 (REVISED 10.09.2026): Poster API client — `createIncomingOrder`

**Superseded design note:** this task originally built `createOrder`
against `POST /api/orders` with `tableId`+`autoAccept: true`. That code was
implemented, tested, reviewed, and committed — then replaced once we found
Poster's own integration guidelines document `incomingOrders.createIncomingOrder`
as the method for third-party/marketplace order submission, and the owner
confirmed staff confirmation at the register is wanted, not a gap to route
around. If executing this plan fresh (no prior commits), just build this
version directly — the "superseded" framing only matters for anyone
diffing against an earlier run of this plan.

**Two API quirks to know before writing this:**
1. Unlike `POST /api/orders` (camelCase fields), `incomingOrders.createIncomingOrder`
   is an older-style Poster endpoint — its request body AND response use
   **snake_case** (`spot_id`, `incoming_order_id`, `product_id`, etc.). The
   client function should still expose a clean camelCase TypeScript API to
   the rest of our code — do the snake_case↔camelCase translation inside
   `client.ts`, the same way `getProducts` already translates Poster's raw
   product shape.
2. This endpoint requires either `client_id` or `phone` — there's no
   anonymous/guest-less order. Per the design spec's Architecture section,
   we pass a fixed per-restaurant placeholder phone with
   `skip_phone_validation: true` (bypasses format checks, does not waive
   the requirement to send the field at all).

**Files:**
- Modify: `lib/poster/types.ts` — remove `CreateOrderRequest`/`CreateOrderResponse`
  (dead code now that `POST /api/orders` isn't used — delete outright, don't
  leave unused exports around per this project's own YAGNI standard). Add:
  ```typescript
  export interface CreateIncomingOrderItem {
    productId: number;
    count: number;
    modificatorId?: number;
  }

  export interface CreateIncomingOrderRequest {
    spotId: number;
    /** Poster requires phone or client_id — see design spec for the placeholder-phone decision for anonymous QR guests. */
    phone: string;
    skipPhoneValidation?: boolean;
    serviceMode: PosterServiceMode;
    /** Table number as free text — this endpoint has no structured table field. e.g. "Стол 7" */
    comment?: string;
    products: CreateIncomingOrderItem[];
  }

  export interface CreateIncomingOrderResult {
    incomingOrderId: number;
    /** Poster's incoming-order status: 0 = new/pending staff confirmation, 1 = accepted, 7 = canceled. */
    status: number;
  }
  ```
  (`PosterServiceMode` already exists from the Task 2 review fix — reuse it, don't redeclare.)
- Create: `lib/poster/client.ts` (or modify, if `getProducts` was already added by an earlier task run)
- Test: `lib/poster/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `lib/poster/client.test.ts` (replacing any prior `createOrder`
describe block, which no longer applies — the function it tested is gone):
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createIncomingOrder } from './client';
import { PosterApiError } from './types';

describe('createIncomingOrder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends spot_id, phone, skip_phone_validation, service_mode, comment, and products in snake_case, and maps the response back to camelCase', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: { incoming_order_id: 106, status: 0, spot_id: 42 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createIncomingOrder('test-token', {
      spotId: 42,
      phone: '+70000000000',
      skipPhoneValidation: true,
      serviceMode: 1,
      comment: 'Стол 7',
      products: [{ productId: 169, count: 2 }],
    });

    expect(result).toEqual({ incomingOrderId: 106, status: 0 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://joinposter.com/api/incomingOrders.createIncomingOrder?token=test-token',
    );
    const body = JSON.parse(options.body as string);
    expect(body.spot_id).toBe(42);
    expect(body.phone).toBe('+70000000000');
    expect(body.skip_phone_validation).toBe(true);
    expect(body.service_mode).toBe(1);
    expect(body.comment).toBe('Стол 7');
    expect(body.products).toEqual([{ product_id: 169, count: 2 }]);
  });

  it('throws PosterApiError when Poster returns a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid phone' } }),
      }),
    );

    await expect(
      createIncomingOrder('test-token', {
        spotId: 42,
        phone: '',
        serviceMode: 1,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toThrow(PosterApiError);
  });

  it('throws PosterApiError instead of returning a garbage result when the response is missing incoming_order_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: { status: 0 } }),
      }),
    );

    await expect(
      createIncomingOrder('test-token', {
        spotId: 42,
        phone: '+7',
        serviceMode: 1,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toThrow(PosterApiError);
  });

  it('wraps a network failure (fetch rejecting) in PosterApiError with statusCode 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(
      createIncomingOrder('test-token', {
        spotId: 42,
        phone: '+7',
        serviceMode: 1,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 0 });
  });
});
```

Note: this test list already bakes in the network-error-wrapping and
response-shape-validation hardening that `createOrder` only got after a
code-review fix round last time — do it right the first time here, no
separate fix round should be needed for these two behaviors.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: FAIL — `createIncomingOrder is not a function` (or "Cannot find
module './client'" if `client.ts` doesn't exist yet in a fresh run of this
plan).

- [ ] **Step 3: Write the minimal implementation**

In `lib/poster/client.ts` (remove the old `createOrder` function entirely —
it's dead code once nothing calls `POST /api/orders` anymore):
```typescript
import type {
  CreateIncomingOrderRequest,
  CreateIncomingOrderResult,
} from './types';
import { PosterApiError } from './types';

const POSTER_BASE_URL = 'https://joinposter.com/api';

export async function createIncomingOrder(
  token: string,
  order: CreateIncomingOrderRequest,
): Promise<CreateIncomingOrderResult> {
  const body = {
    spot_id: order.spotId,
    phone: order.phone,
    skip_phone_validation: order.skipPhoneValidation,
    service_mode: order.serviceMode,
    comment: order.comment,
    products: order.products.map((item) => ({
      product_id: item.productId,
      count: item.count,
      ...(item.modificatorId !== undefined
        ? { modificator_id: item.modificatorId }
        : {}),
    })),
  };

  let response: Response;
  try {
    response = await fetch(
      `${POSTER_BASE_URL}/incomingOrders.createIncomingOrder?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster API: ${message}`, 0);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new PosterApiError(
      errorBody?.error?.message ??
        `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const parsed = await response.json();
  const incomingOrderId = parsed?.response?.incoming_order_id;
  if (typeof incomingOrderId !== 'number') {
    throw new PosterApiError(
      'Poster returned an unexpected incoming order response shape',
      response.status,
    );
  }

  return {
    incomingOrderId,
    status: parsed.response.status,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/poster/types.ts lib/poster/client.ts lib/poster/client.test.ts
git commit -m "feat: replace autoAccept createOrder with incomingOrders.createIncomingOrder (staff confirms)"
```

---

### Task 4: Poster API client — fetch menu and ingredients

**Files:**
- Modify: `lib/poster/client.ts`
- Modify: `lib/poster/client.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/poster/client.test.ts`:
```typescript
import { getProducts } from './client';

describe('getProducts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps Poster product + ingredient fields into our PosterProduct shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            {
              product_id: '169',
              product_name: 'Стейк рибай',
              description: 'Сочный стейк',
              price: { '1': '420000' },
              ingredient_name: ['говядина', 'розмарин'],
              hidden: '0',
            },
            {
              product_id: '170',
              product_name: 'Салат без описания состава',
              description: '',
              price: { '1': '150000' },
              ingredient_name: null,
              hidden: '0',
            },
          ],
        }),
      }),
    );

    const products = await getProducts('test-token');

    expect(products).toHaveLength(2);
    expect(products[0]).toEqual({
      productId: 169,
      name: 'Стейк рибай',
      description: 'Сочный стейк',
      price: 4200,
      ingredients: [{ name: 'говядина' }, { name: 'розмарин' }],
      inStopList: false,
    });
    expect(products[1].ingredients).toBeNull();
  });
});
```

Note: `price` from Poster's `getProducts` comes in minor units (kopecks/
tiyn) per spot, keyed by spot id — this test uses spot `"1"` and divides by
100 to get a real currency amount, matching how the spec's structured
per-dish JSON expects a plain `price`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: FAIL — `getProducts is not a function`

- [ ] **Step 3: Write the minimal implementation**

Add to `lib/poster/client.ts`:
```typescript
import type { PosterProduct } from './types';

interface RawPosterProduct {
  product_id: string;
  product_name: string;
  description: string;
  price: Record<string, string>;
  ingredient_name: string[] | null;
  hidden: string;
}

export async function getProducts(token: string): Promise<PosterProduct[]> {
  const response = await fetch(
    `${POSTER_BASE_URL}/menu.getProducts?token=${token}`,
  );

  if (!response.ok) {
    throw new PosterApiError(
      `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const { response: rawProducts } = (await response.json()) as {
    response: RawPosterProduct[];
  };

  return rawProducts.map((raw) => ({
    productId: Number(raw.product_id),
    name: raw.product_name,
    description: raw.description,
    price: Number(Object.values(raw.price)[0]) / 100,
    ingredients: raw.ingredient_name
      ? raw.ingredient_name.map((name) => ({ name }))
      : null,
    inStopList: raw.hidden === '1',
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/poster/client.ts lib/poster/client.test.ts
git commit -m "feat: add Poster getProducts client with ingredient mapping"
```

**Verify against the live API before Plan 2 depends on this:** the exact
raw field names above (`product_id`, `ingredient_name`, etc.) are typical
Poster v3 field naming but were not confirmed byte-for-byte against a real
`menu.getProducts` response in this session — call it once with a real
token during Task 5 and adjust the mapping if field names differ.

---

### Task 5: Supabase schema for menu cache

**Files:**
- Create: `supabase/migrations/20260910120000_init_menu_cache.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260910120000_init_menu_cache.sql`:
```sql
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  poster_spot_id integer not null,
  poster_token text not null,
  created_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  poster_product_id integer not null,
  name text not null,
  description text not null default '',
  price numeric not null,
  ingredients jsonb,
  ingredients_known boolean not null,
  in_stop_list boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, poster_product_id)
);

create index menu_items_restaurant_id_idx on menu_items(restaurant_id);
```

Note on `ingredients_known`: stored as its own column (not derived from
`ingredients is not null`) so the AI-grounding layer in Plan 2 can filter
on it directly without re-deriving the rule in application code.

Note on access: this MVP has no browser code that talks to Supabase
directly — only server-side Next.js API routes do, using the service-role
key. Row Level Security is deliberately deferred (tracked in the spec's
open questions) since there's no anon-key client path yet to secure
against; add RLS policies before any client-side Supabase access is
introduced in a later plan.

- [ ] **Step 2: Apply the migration to a local Supabase instance**

Run: `npx supabase db reset`
Expected: migration applies without error; `restaurants` and `menu_items`
tables exist (verify with `npx supabase db diff` showing no pending
changes).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260910120000_init_menu_cache.sql
git commit -m "feat: add restaurants and menu_items schema"
```

---

### Task 6: Menu sync — Poster to Supabase cache

**Files:**
- Create: `lib/menu/sync.ts`
- Test: `lib/menu/sync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/menu/sync.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { syncMenu } from './sync';
import type { PosterProduct } from '../poster/types';

describe('syncMenu', () => {
  it('upserts each Poster product into menu_items with ingredients_known derived from ingredients', async () => {
    const products: PosterProduct[] = [
      {
        productId: 169,
        name: 'Стейк рибай',
        description: 'Сочный стейк',
        price: 4200,
        ingredients: [{ name: 'говядина' }],
        inStopList: false,
      },
      {
        productId: 170,
        name: 'Салат без состава',
        description: '',
        price: 1500,
        ingredients: null,
        inStopList: false,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    await syncMenu(supabase as any, getProducts, {
      restaurantId: 'r1',
      posterToken: 'tok',
    });

    expect(getProducts).toHaveBeenCalledWith('tok');
    expect(supabase.from).toHaveBeenCalledWith('menu_items');
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          restaurant_id: 'r1',
          poster_product_id: 169,
          ingredients: [{ name: 'говядина' }],
          ingredients_known: true,
        }),
        expect.objectContaining({
          restaurant_id: 'r1',
          poster_product_id: 170,
          ingredients: null,
          ingredients_known: false,
        }),
      ],
      { onConflict: 'restaurant_id,poster_product_id' },
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/menu/sync.test.ts`
Expected: FAIL — `Cannot find module './sync'`

- [ ] **Step 3: Write the minimal implementation**

Create `lib/menu/sync.ts`:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PosterProduct } from '../poster/types';

type GetProductsFn = (token: string) => Promise<PosterProduct[]>;

export async function syncMenu(
  supabase: SupabaseClient,
  getProducts: GetProductsFn,
  args: { restaurantId: string; posterToken: string },
): Promise<void> {
  const products = await getProducts(args.posterToken);

  const rows = products.map((product) => ({
    restaurant_id: args.restaurantId,
    poster_product_id: product.productId,
    name: product.name,
    description: product.description,
    price: product.price,
    ingredients: product.ingredients,
    ingredients_known: product.ingredients !== null,
    in_stop_list: product.inStopList,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('menu_items')
    .upsert(rows, { onConflict: 'restaurant_id,poster_product_id' });

  if (error) {
    throw new Error(`Failed to sync menu: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/menu/sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/menu/sync.ts lib/menu/sync.test.ts
git commit -m "feat: sync Poster menu into Supabase cache"
```

---

### Task 7: Ingredient completeness check (onboarding)

**Files:**
- Create: `lib/menu/completeness.ts`
- Test: `lib/menu/completeness.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/menu/completeness.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getIngredientCompleteness } from './completeness';

describe('getIngredientCompleteness', () => {
  it('counts how many menu items have known ingredients and names the ones that do not', () => {
    const items = [
      { name: 'Стейк рибай', ingredients_known: true },
      { name: 'Салат без состава', ingredients_known: false },
      { name: 'Плов', ingredients_known: true },
    ];

    const result = getIngredientCompleteness(items);

    expect(result).toEqual({
      total: 3,
      withIngredients: 2,
      missingDishNames: ['Салат без состава'],
    });
  });

  it('handles an empty menu without dividing by zero', () => {
    expect(getIngredientCompleteness([])).toEqual({
      total: 0,
      withIngredients: 0,
      missingDishNames: [],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/menu/completeness.test.ts`
Expected: FAIL — `Cannot find module './completeness'`

- [ ] **Step 3: Write the minimal implementation**

Create `lib/menu/completeness.ts`:
```typescript
interface MenuItemForCompleteness {
  name: string;
  ingredients_known: boolean;
}

export interface CompletenessResult {
  total: number;
  withIngredients: number;
  missingDishNames: string[];
}

export function getIngredientCompleteness(
  items: MenuItemForCompleteness[],
): CompletenessResult {
  return {
    total: items.length,
    withIngredients: items.filter((item) => item.ingredients_known).length,
    missingDishNames: items
      .filter((item) => !item.ingredients_known)
      .map((item) => item.name),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/menu/completeness.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/menu/completeness.ts lib/menu/completeness.test.ts
git commit -m "feat: add ingredient-completeness check for onboarding"
```

---

### Task 8 (REVISED 10.09.2026): Order creation API route

**Files:**
- Create: `lib/orders/createTableOrder.ts`
- Test: `lib/orders/createTableOrder.test.ts`
- Create: `app/api/orders/route.ts`

This is the task that fulfils the spec's core (now-corrected) claim: a
guest order for a table appears on the register in seconds, for staff to
accept with one tap — not fully automatic (see Task 3's revision note for
why). The Next.js route stays a thin wrapper; the logic is in a plain
function so it's testable without spinning up an HTTP server.

`tableLabel` (not `tableId`) is a deliberate naming choice: since
`incomingOrders.createIncomingOrder` has no structured table field, the
table number is just free text baked into `comment` — calling it `tableId`
would wrongly suggest it's a real Poster identifier.

- [ ] **Step 1: Write the failing test**

Create `lib/orders/createTableOrder.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { createTableOrder } from './createTableOrder';

describe('createTableOrder', () => {
  it('looks up the restaurant, then submits an incoming order with the table number in the comment and a placeholder phone', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({
      posterSpotId: 42,
      posterToken: 'tok',
    });
    const createIncomingOrder = vi.fn().mockResolvedValue({
      incomingOrderId: 106,
      status: 0,
    });

    const result = await createTableOrder(
      { getRestaurant, createIncomingOrder },
      {
        restaurantId: 'r1',
        tableLabel: '7',
        items: [{ productId: 169, count: 2 }],
      },
    );

    expect(getRestaurant).toHaveBeenCalledWith('r1');
    expect(createIncomingOrder).toHaveBeenCalledWith('tok', {
      spotId: 42,
      phone: '+00000000000',
      skipPhoneValidation: true,
      serviceMode: 1,
      comment: 'Стол 7',
      products: [{ productId: 169, count: 2 }],
    });
    expect(result).toEqual({ posterIncomingOrderId: 106 });
  });

  it('rejects an empty item list before calling Poster at all', async () => {
    const getRestaurant = vi.fn();
    const createIncomingOrder = vi.fn();

    await expect(
      createTableOrder(
        { getRestaurant, createIncomingOrder },
        { restaurantId: 'r1', tableLabel: '7', items: [] },
      ),
    ).rejects.toThrow('at least one item');
    expect(getRestaurant).not.toHaveBeenCalled();
    expect(createIncomingOrder).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/orders/createTableOrder.test.ts`
Expected: FAIL — `Cannot find module './createTableOrder'`

- [ ] **Step 3: Write the minimal implementation**

Create `lib/orders/createTableOrder.ts`:
```typescript
import type {
  CreateIncomingOrderItem,
  CreateIncomingOrderResult,
} from '../poster/types';

/**
 * Poster requires phone or client_id on every incoming order; guests here
 * are anonymous (no login, no phone collected — see design spec). Known
 * MVP limitation: all QR orders for a restaurant attribute to this one
 * placeholder "customer" in Poster's own client records.
 */
const QR_GUEST_PLACEHOLDER_PHONE = '+00000000000';

interface RestaurantLookup {
  posterSpotId: number;
  posterToken: string;
}

interface Deps {
  getRestaurant: (restaurantId: string) => Promise<RestaurantLookup>;
  createIncomingOrder: (
    token: string,
    order: {
      spotId: number;
      phone: string;
      skipPhoneValidation: true;
      serviceMode: 1;
      comment: string;
      products: CreateIncomingOrderItem[];
    },
  ) => Promise<CreateIncomingOrderResult>;
}

interface CreateTableOrderArgs {
  restaurantId: string;
  tableLabel: string;
  items: CreateIncomingOrderItem[];
}

export async function createTableOrder(
  deps: Deps,
  args: CreateTableOrderArgs,
): Promise<{ posterIncomingOrderId: number }> {
  if (args.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  const restaurant = await deps.getRestaurant(args.restaurantId);

  const result = await deps.createIncomingOrder(restaurant.posterToken, {
    spotId: restaurant.posterSpotId,
    phone: QR_GUEST_PLACEHOLDER_PHONE,
    skipPhoneValidation: true,
    serviceMode: 1,
    comment: `Стол ${args.tableLabel}`,
    products: args.items,
  });

  return { posterIncomingOrderId: result.incomingOrderId };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/orders/createTableOrder.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the Next.js route (thin wrapper, no new logic to test)**

Create `app/api/orders/route.ts`. Note this bakes in a fix already
identified during Task 3's code review but not yet applied anywhere: a
`PosterApiError` with `statusCode: 0` means Poster was never reached
(network failure) — that's not the guest's fault, so it should map to
HTTP 502, not a flat 400 for every failure:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTableOrder } from '@/lib/orders/createTableOrder';
import { createIncomingOrder } from '@/lib/poster/client';
import { PosterApiError } from '@/lib/poster/types';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getRestaurant(restaurantId: string) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('poster_spot_id, poster_token')
    .eq('id', restaurantId)
    .single();

  if (error || !data) {
    throw new Error(`Restaurant not found: ${restaurantId}`);
  }

  return { posterSpotId: data.poster_spot_id, posterToken: data.poster_token };
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const result = await createTableOrder(
      { getRestaurant, createIncomingOrder },
      {
        restaurantId: body.restaurantId,
        tableLabel: body.tableLabel,
        items: body.items,
      },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PosterApiError && error.statusCode === 0) {
      return NextResponse.json(
        { error: 'Could not reach Poster right now, please try again' },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/orders/createTableOrder.ts lib/orders/createTableOrder.test.ts app/api/orders/route.ts
git commit -m "feat: add table order creation endpoint (staff confirms via incomingOrders)"
```

---

### Task 9: Run the full suite before calling Plan 1 done

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests across `lib/poster`, `lib/menu`, `lib/orders` PASS,
0 failures.

- [ ] **Step 2: Manual smoke check against the real Poster sandbox**

Using a real (or Poster-provided test) token and spot, call
`getProducts` and `createIncomingOrder` directly (e.g. via a scratch script) to
confirm the raw field names assumed in Task 4 match reality. Fix the
mapping in `lib/poster/client.ts` if they don't — this is the one place
in this plan relying on unverified field names (flagged in the spec's
"Открытые вопросы" and again in Task 4).

---

### Task 10 (added 10.09.2026): OAuth authorization flow

Added after Poster's own developer console confirmed marketplace apps must
use oAuth, not a manually-pasted token (tracked since 10.09.2026 as a
pre-publication requirement in the design spec). Field names below are
verified live against `dev.joinposter.com/docs/v3/start/authApi` and
`dev.joinposter.com/docs/v3/web/spots/getSpots` — not guessed.

Poster's oAuth has no refresh token: `access_token` is valid 2 years and
already comes back in the same `accountNumber:hash` shape the `poster_token`
column already stores, so no schema change is needed for the token itself.
What Poster's oAuth response does *not* include is a spot id — solved by
calling `spots.getSpots` right after the token exchange and taking the first
spot (MVP single-spot assumption, consistent with `getProducts`'s existing
one). This resolves the open question from Task 3's revision — no separate
"pick your spot" onboarding step is needed for MVP.

**Files:**
- Create: `lib/poster/oauth.ts`
- Test: `lib/poster/oauth.test.ts`
- Create: `lib/oauth/completeOAuthConnection.ts`
- Test: `lib/oauth/completeOAuthConnection.test.ts`
- Create: `app/api/oauth/start/route.ts`
- Create: `app/api/oauth/callback/route.ts`
- Create migration: `supabase/migrations/20260910130000_add_poster_account_number.sql`
- Modify: `.env.local.example` (add `POSTER_APPLICATION_ID`, `POSTER_APPLICATION_SECRET`, `POSTER_OAUTH_REDIRECT_URI`)

`lib/poster/oauth.ts` and `lib/oauth/completeOAuthConnection.ts` are two
separate layers on purpose, mirroring the existing `lib/poster/client.ts` /
`lib/orders/createTableOrder.ts` split: the first talks to Poster's raw API
(mockable at the fetch boundary), the second is a small dependency-injected
orchestration function that the two API routes call — this is what makes
Task 8's route thin and testable, and the same shape is used here so the
callback route doesn't accumulate untested business logic.

- [ ] **Step 1: Write the failing tests for `lib/poster/oauth.ts`**

Create `lib/poster/oauth.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { exchangeOAuthCode, getSpots } from './oauth';
import { PosterApiError } from './types';

describe('exchangeOAuthCode', () => {
  beforeEach(() => {
    vi.stubEnv('POSTER_APPLICATION_ID', '5313');
    vi.stubEnv('POSTER_APPLICATION_SECRET', 'test-secret');
    vi.stubEnv('POSTER_OAUTH_REDIRECT_URI', 'http://localhost:3000/api/oauth/callback');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts form-data with application_id/secret/grant_type/redirect_uri/code and maps the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: '687409:abc123', account_number: '687409' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exchangeOAuthCode('mycafe', 'the-code');

    expect(result).toEqual({ accessToken: '687409:abc123', accountNumber: '687409' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mycafe.joinposter.com/api/v2/auth/access_token');
    expect(options.method).toBe('POST');
    const body = options.body as URLSearchParams;
    expect(body.get('application_id')).toBe('5313');
    expect(body.get('application_secret')).toBe('test-secret');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('redirect_uri')).toBe('http://localhost:3000/api/oauth/callback');
    expect(body.get('code')).toBe('the-code');
  });

  it('throws a clear error if required env vars are missing', async () => {
    vi.stubEnv('POSTER_APPLICATION_SECRET', '');

    await expect(exchangeOAuthCode('mycafe', 'the-code')).rejects.toThrow(
      'POSTER_APPLICATION_SECRET',
    );
  });

  it('throws PosterApiError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error_message: 'Invalid code' }),
      }),
    );

    await expect(exchangeOAuthCode('mycafe', 'bad-code')).rejects.toThrow(PosterApiError);
  });

  it('throws PosterApiError when the response is missing access_token or account_number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ account_number: '687409' }) }),
    );

    await expect(exchangeOAuthCode('mycafe', 'the-code')).rejects.toThrow(PosterApiError);
  });

  it('wraps a network failure in PosterApiError with statusCode 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(exchangeOAuthCode('mycafe', 'the-code')).rejects.toMatchObject({
      statusCode: 0,
    });
  });
});

describe('getSpots', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps spot_id/name/address, coercing a stringly-typed spot_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            { spot_id: '1', name: 'Кафе на Полянке', address: 'Киев, ул. Б.Полянка 44' },
            { spot_id: 2, name: 'Вторая точка', address: 'Алматы' },
          ],
        }),
      }),
    );

    const spots = await getSpots('687409:abc123');

    expect(spots).toEqual([
      { spotId: 1, name: 'Кафе на Полянке', address: 'Киев, ул. Б.Полянка 44' },
      { spotId: 2, name: 'Вторая точка', address: 'Алматы' },
    ]);
  });

  it('throws PosterApiError when the response is not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    await expect(getSpots('tok')).rejects.toThrow(PosterApiError);
  });

  it('throws PosterApiError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    await expect(getSpots('bad-token')).rejects.toThrow(PosterApiError);
  });

  it('wraps a network failure in PosterApiError with statusCode 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(getSpots('tok')).rejects.toMatchObject({ statusCode: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/poster/oauth.test.ts`
Expected: FAIL — `Cannot find module './oauth'`

- [ ] **Step 3: Write the minimal implementation**

Create `lib/poster/oauth.ts`:
```typescript
import { PosterApiError } from './types';

export interface PosterSpot {
  spotId: number;
  name: string;
  address: string;
}

export interface ExchangeOAuthCodeResult {
  accessToken: string;
  accountNumber: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function exchangeOAuthCode(
  account: string,
  code: string,
): Promise<ExchangeOAuthCodeResult> {
  const body = new URLSearchParams({
    application_id: requireEnv('POSTER_APPLICATION_ID'),
    application_secret: requireEnv('POSTER_APPLICATION_SECRET'),
    grant_type: 'authorization_code',
    redirect_uri: requireEnv('POSTER_OAUTH_REDIRECT_URI'),
    code,
  });

  let response: Response;
  try {
    response = await fetch(`https://${account}.joinposter.com/api/v2/auth/access_token`, {
      method: 'POST',
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster OAuth token endpoint: ${message}`, 0);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new PosterApiError(
      errorBody?.error_message ??
        `Poster OAuth token exchange failed with status ${response.status}`,
      response.status,
    );
  }

  const parsed = await response.json();
  const accessToken = parsed?.access_token;
  const accountNumber = parsed?.account_number;
  if (
    typeof accessToken !== 'string' ||
    !accessToken ||
    typeof accountNumber !== 'string' ||
    !accountNumber
  ) {
    throw new PosterApiError(
      'Poster OAuth token response missing access_token/account_number',
      response.status,
    );
  }

  return { accessToken, accountNumber };
}

export async function getSpots(token: string): Promise<PosterSpot[]> {
  let response: Response;
  try {
    response = await fetch(`https://joinposter.com/api/spots.getSpots?token=${token}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster spots.getSpots: ${message}`, 0);
  }

  if (!response.ok) {
    throw new PosterApiError(
      `Poster spots.getSpots failed with status ${response.status}`,
      response.status,
    );
  }

  const parsed = await response.json();
  const rawSpots = parsed?.response;
  if (!Array.isArray(rawSpots)) {
    throw new PosterApiError(
      'Poster spots.getSpots returned an unexpected response shape',
      response.status,
    );
  }

  return rawSpots.map((raw) => {
    const spotId = Number(raw?.spot_id);
    if (!Number.isFinite(spotId)) {
      throw new PosterApiError(
        'Poster spots.getSpots returned a spot with no valid spot_id',
        response.status,
      );
    }
    return {
      spotId,
      name: String(raw?.name ?? ''),
      address: String(raw?.address ?? ''),
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/poster/oauth.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Write the failing tests for `lib/oauth/completeOAuthConnection.ts`**

Create `lib/oauth/completeOAuthConnection.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { completeOAuthConnection } from './completeOAuthConnection';

describe('completeOAuthConnection', () => {
  it('exchanges the code, fetches spots, and upserts the restaurant using the first spot', async () => {
    const exchangeOAuthCode = vi
      .fn()
      .mockResolvedValue({ accessToken: '687409:abc123', accountNumber: '687409' });
    const getSpots = vi.fn().mockResolvedValue([
      { spotId: 1, name: 'Кафе на Полянке', address: 'Киев' },
      { spotId: 2, name: 'Вторая точка', address: 'Алматы' },
    ]);
    const upsertRestaurant = vi.fn().mockResolvedValue(undefined);

    const result = await completeOAuthConnection(
      { exchangeOAuthCode, getSpots, upsertRestaurant },
      { account: 'mycafe', code: 'the-code' },
    );

    expect(exchangeOAuthCode).toHaveBeenCalledWith('mycafe', 'the-code');
    expect(getSpots).toHaveBeenCalledWith('687409:abc123');
    expect(upsertRestaurant).toHaveBeenCalledWith({
      posterAccountNumber: '687409',
      posterSpotId: 1,
      posterToken: '687409:abc123',
      name: 'Кафе на Полянке',
    });
    expect(result).toEqual({ restaurantName: 'Кафе на Полянке' });
  });

  it('throws without upserting when the account has no spots', async () => {
    const exchangeOAuthCode = vi
      .fn()
      .mockResolvedValue({ accessToken: 'tok', accountNumber: '687409' });
    const getSpots = vi.fn().mockResolvedValue([]);
    const upsertRestaurant = vi.fn();

    await expect(
      completeOAuthConnection(
        { exchangeOAuthCode, getSpots, upsertRestaurant },
        { account: 'mycafe', code: 'the-code' },
      ),
    ).rejects.toThrow('no spots');
    expect(upsertRestaurant).not.toHaveBeenCalled();
  });

  it('propagates an exchangeOAuthCode failure without calling getSpots or upsertRestaurant', async () => {
    const exchangeError = new Error('bad code');
    const exchangeOAuthCode = vi.fn().mockRejectedValue(exchangeError);
    const getSpots = vi.fn();
    const upsertRestaurant = vi.fn();

    await expect(
      completeOAuthConnection(
        { exchangeOAuthCode, getSpots, upsertRestaurant },
        { account: 'mycafe', code: 'bad-code' },
      ),
    ).rejects.toThrow(exchangeError);
    expect(getSpots).not.toHaveBeenCalled();
    expect(upsertRestaurant).not.toHaveBeenCalled();
  });

  it('propagates a getSpots failure without calling upsertRestaurant', async () => {
    const exchangeOAuthCode = vi
      .fn()
      .mockResolvedValue({ accessToken: 'tok', accountNumber: '687409' });
    const spotsError = new Error('spots lookup failed');
    const getSpots = vi.fn().mockRejectedValue(spotsError);
    const upsertRestaurant = vi.fn();

    await expect(
      completeOAuthConnection(
        { exchangeOAuthCode, getSpots, upsertRestaurant },
        { account: 'mycafe', code: 'the-code' },
      ),
    ).rejects.toThrow(spotsError);
    expect(upsertRestaurant).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run lib/oauth/completeOAuthConnection.test.ts`
Expected: FAIL — `Cannot find module './completeOAuthConnection'`

- [ ] **Step 7: Write the minimal implementation**

Create `lib/oauth/completeOAuthConnection.ts`:
```typescript
export interface OAuthConnectionDeps {
  exchangeOAuthCode: (
    account: string,
    code: string,
  ) => Promise<{ accessToken: string; accountNumber: string }>;
  getSpots: (token: string) => Promise<{ spotId: number; name: string; address: string }[]>;
  upsertRestaurant: (restaurant: {
    posterAccountNumber: string;
    posterSpotId: number;
    posterToken: string;
    name: string;
  }) => Promise<void>;
}

export async function completeOAuthConnection(
  deps: OAuthConnectionDeps,
  args: { account: string; code: string },
): Promise<{ restaurantName: string }> {
  const { accessToken, accountNumber } = await deps.exchangeOAuthCode(args.account, args.code);
  const spots = await deps.getSpots(accessToken);

  if (spots.length === 0) {
    throw new Error('This Poster account has no spots to connect');
  }

  const spot = spots[0];

  await deps.upsertRestaurant({
    posterAccountNumber: accountNumber,
    posterSpotId: spot.spotId,
    posterToken: accessToken,
    name: spot.name,
  });

  return { restaurantName: spot.name };
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run lib/oauth/completeOAuthConnection.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Add the migration**

Create `supabase/migrations/20260910130000_add_poster_account_number.sql`:
```sql
-- Add support for Poster oAuth-based onboarding.
-- poster_account_number is the natural key for the oAuth callback's upsert:
-- there is no restaurant row yet when the oAuth redirect arrives, so this
-- is what we upsert on instead of our own generated id. Nullable because
-- the pre-existing manual-token onboarding path never sets it.
alter table restaurants
  add column poster_account_number text unique;
```

- [ ] **Step 10: Wire the two Next.js routes (thin wrappers, no new logic to test)**

Create `app/api/oauth/start/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const applicationId = process.env.POSTER_APPLICATION_ID;
  const redirectUri = process.env.POSTER_OAUTH_REDIRECT_URI;

  if (!applicationId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          'OAuth is not configured (missing POSTER_APPLICATION_ID or POSTER_OAUTH_REDIRECT_URI)',
      },
      { status: 500 },
    );
  }

  const authorizeUrl = new URL('https://joinposter.com/api/auth');
  authorizeUrl.searchParams.set('application_id', applicationId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(authorizeUrl.toString());
}
```

Create `app/api/oauth/callback/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { completeOAuthConnection } from '@/lib/oauth/completeOAuthConnection';
import { exchangeOAuthCode, getSpots } from '@/lib/poster/oauth';
import { PosterApiError } from '@/lib/poster/types';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const account = request.nextUrl.searchParams.get('account');

  if (!code || !account) {
    return NextResponse.json(
      { error: 'Missing code or account query parameter' },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Server is misconfigured (missing Supabase credentials)' },
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  async function upsertRestaurant(restaurant: {
    posterAccountNumber: string;
    posterSpotId: number;
    posterToken: string;
    name: string;
  }) {
    const { error } = await supabase.from('restaurants').upsert(
      {
        poster_account_number: restaurant.posterAccountNumber,
        poster_spot_id: restaurant.posterSpotId,
        poster_token: restaurant.posterToken,
        name: restaurant.name,
      },
      { onConflict: 'poster_account_number' },
    );
    if (error) {
      throw new Error(`Failed to save restaurant after OAuth: ${error.message}`);
    }
  }

  try {
    const result = await completeOAuthConnection(
      { exchangeOAuthCode, getSpots, upsertRestaurant },
      { account, code },
    );
    return NextResponse.json({ connected: true, restaurantName: result.restaurantName });
  } catch (error) {
    if (error instanceof PosterApiError && error.statusCode === 0) {
      return NextResponse.json(
        { error: 'Could not reach Poster right now, please try again' },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 11: Add the new env vars to the example file**

Modify `.env.local.example` — add:
```
POSTER_APPLICATION_ID=
POSTER_APPLICATION_SECRET=
POSTER_OAUTH_REDIRECT_URI=http://localhost:3000/api/oauth/callback
```

- [ ] **Step 12: Verify and commit**

Run:
1. `npx vitest run lib/poster/oauth.test.ts lib/oauth/completeOAuthConnection.test.ts` — must pass (13 tests)
2. `npx tsc --noEmit` — must be clean
3. `npx eslint lib/poster lib/oauth app/api/oauth` — must be clean

```bash
git add lib/poster/oauth.ts lib/poster/oauth.test.ts lib/oauth/completeOAuthConnection.ts lib/oauth/completeOAuthConnection.test.ts app/api/oauth/start/route.ts app/api/oauth/callback/route.ts supabase/migrations/20260910130000_add_poster_account_number.sql .env.local.example
git commit -m "feat: add Poster oAuth authorization flow"
```

---

### Task 11 (added 11.09.2026): Real per-dish ingredients (live-test finding)

Found by connecting a real Poster account via the oAuth flow built in Task 10
and calling the real `menu.getProducts`/`menu.getProduct` endpoints: our
Task 4 implementation was wrong about where ingredient data lives. Verified
live against `dev.joinposter.com/docs/v3/web/menu/getProduct` and real
account data — not guessed.

Real facts: `menu.getProducts` (the list endpoint) has **no** `ingredient_name`
field and **no** `description` field at all — our old code silently produced
`ingredients: null`/`ingredients_known: false` for every single product,
always, regardless of real data. Poster's `type` field tells you what a
product actually is: `1` = полуфабрикат (semi-finished component of a
recipe, not a guest-orderable dish), `2` = тех.карта (a real dish with a
recipe), `3` = товар (a plain retail item like bottled water — no recipe by
design, not a data gap). Only `menu.getProduct` (singular, one call per
product) returns a real `ingredients` array, and only for `type: 2`.

Known, accepted limitation carried forward from this finding: an ingredient
inside a tech card can itself be a полуфабрикат (`structure_type: 2`) with
its own hidden sub-recipe (e.g. "Тесто для круассанов" might itself contain
egg/gluten) — this level of nesting is not expanded. Documented in the spec,
not fixed in this task.

**Files:**
- Modify: `lib/poster/types.ts`
- Modify: `lib/poster/client.ts`
- Modify: `lib/poster/client.test.ts`
- Modify: `lib/menu/sync.ts`
- Modify: `lib/menu/sync.test.ts`

- [ ] **Step 1: Update types**

In `lib/poster/types.ts`, replace the `PosterProduct` interface and add
`PosterProductType`:
```typescript
/**
 * Poster product types: 1 = полуфабрикат (semi-finished component, not a
 * guest-orderable dish), 2 = тех.карта (a recipe/dish — the only type that
 * carries a real ingredient breakdown, and only via getProduct, not
 * getProducts), 3 = товар (a plain retail item, e.g. bottled water — has no
 * recipe by design, not a data gap).
 */
export type PosterProductType = 1 | 2 | 3;

export interface PosterProduct {
  productId: number;
  name: string;
  /**
   * Poster's product-list endpoint (menu.getProducts) has no description
   * field at all — always empty string from that source today. Left in the
   * domain type for a future manual-entry path, not currently populated.
   */
  description: string;
  /** Normalized to major currency units (e.g. tenge) — NOT Poster's raw minor-unit price. */
  price: number;
  type: PosterProductType;
  inStopList: boolean;
}
```
Remove the old `ingredients: PosterIngredientRef[] | null;` field from
`PosterProduct` — keep the `PosterIngredientRef` interface itself, it's
still used by `getProductIngredients`'s return type.

- [ ] **Step 2: Write the failing tests for the reworked `getProducts` and new `getProductIngredients`**

Replace the `describe('getProducts', ...)` block in `lib/poster/client.test.ts`
with:
```typescript
describe('getProducts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps Poster product fields into our PosterProduct shape, including type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            {
              product_id: '169',
              product_name: 'Стейк рибай',
              price: { '1': '420000' },
              type: '2',
              hidden: '0',
            },
            {
              product_id: '3',
              product_name: 'Вода минеральная',
              price: { '1': '100000' },
              type: '3',
              hidden: '0',
            },
          ],
        }),
      }),
    );

    const products = await getProducts('test-token');

    expect(products).toEqual([
      {
        productId: 169,
        name: 'Стейк рибай',
        description: '',
        price: 4200,
        type: 2,
        inStopList: false,
      },
      {
        productId: 3,
        name: 'Вода минеральная',
        description: '',
        price: 1000,
        type: 3,
        inStopList: false,
      },
    ]);
  });

  it('throws PosterApiError instead of producing a NaN price when a product has no price at any spot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            {
              product_id: '169',
              product_name: 'Стейк рибай',
              price: {},
              type: '2',
              hidden: '0',
            },
          ],
        }),
      }),
    );

    await expect(getProducts('test-token')).rejects.toThrow(PosterApiError);
  });

  it('throws PosterApiError when a product has an unrecognized type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            {
              product_id: '169',
              product_name: 'Стейк рибай',
              price: { '1': '420000' },
              type: '9',
              hidden: '0',
            },
          ],
        }),
      }),
    );

    await expect(getProducts('test-token')).rejects.toThrow(PosterApiError);
  });
});

describe('getProductIngredients', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps a тех.карта response ingredients array to PosterIngredientRef[]', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          ingredients: [{ ingredient_name: 'Вода' }, { ingredient_name: 'Кофе' }],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ingredients = await getProductIngredients('test-token', 3);

    expect(ingredients).toEqual([{ name: 'Вода' }, { name: 'Кофе' }]);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://joinposter.com/api/menu.getProduct?token=test-token&product_id=3');
  });

  it('returns an empty array for a товар with no ingredients field at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: {} }) }),
    );

    const ingredients = await getProductIngredients('test-token', 1);

    expect(ingredients).toEqual([]);
  });

  it('throws PosterApiError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );

    await expect(getProductIngredients('test-token', 999)).rejects.toThrow(PosterApiError);
  });

  it('wraps a network failure in PosterApiError with statusCode 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(getProductIngredients('test-token', 1)).rejects.toMatchObject({
      statusCode: 0,
    });
  });
});
```
Update the import line at the top of the file to also import
`getProductIngredients`:
```typescript
import { createIncomingOrder, getProducts, getProductIngredients } from './client';
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: FAIL — old assertions on `ingredients`/`description` no longer
match, `getProductIngredients` is not exported yet.

- [ ] **Step 4: Rewrite the implementation**

Replace the entire contents of `lib/poster/client.ts` with:
```typescript
import type {
  CreateIncomingOrderRequest,
  CreateIncomingOrderResult,
  PosterIngredientRef,
  PosterProduct,
  PosterProductType,
} from './types';
import { PosterApiError } from './types';

const POSTER_BASE_URL = 'https://joinposter.com/api';

interface RawPosterProduct {
  product_id: string;
  product_name: string;
  price: Record<string, string>;
  type: string;
  hidden: string;
}

interface RawPosterIngredient {
  ingredient_name: string;
}

interface RawPosterProductDetail {
  ingredients?: RawPosterIngredient[];
}

export async function createIncomingOrder(
  token: string,
  order: CreateIncomingOrderRequest,
): Promise<CreateIncomingOrderResult> {
  const body = {
    spot_id: order.spotId,
    phone: order.phone,
    skip_phone_validation: order.skipPhoneValidation,
    service_mode: order.serviceMode,
    comment: order.comment,
    products: order.products.map((item) => ({
      product_id: item.productId,
      count: item.count,
      ...(item.modificatorId !== undefined ? { modificator_id: item.modificatorId } : {}),
    })),
  };

  let response: Response;
  try {
    response = await fetch(
      `${POSTER_BASE_URL}/incomingOrders.createIncomingOrder?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster API: ${message}`, 0);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new PosterApiError(
      errorBody?.error?.message ?? `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const parsed = await response.json();
  const incomingOrderId = Number(parsed?.response?.incoming_order_id);
  const status = Number(parsed?.response?.status);
  if (!Number.isFinite(incomingOrderId) || !Number.isFinite(status)) {
    throw new PosterApiError(
      'Poster returned an unexpected incoming order response shape',
      response.status,
    );
  }

  return { incomingOrderId, status };
}

export async function getProducts(token: string): Promise<PosterProduct[]> {
  let response: Response;
  try {
    response = await fetch(`${POSTER_BASE_URL}/menu.getProducts?token=${token}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster API: ${message}`, 0);
  }

  if (!response.ok) {
    throw new PosterApiError(
      `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const { response: rawProducts } = (await response.json()) as {
    response: RawPosterProduct[];
  };

  return rawProducts.map((raw) => {
    // MVP assumption: one Poster spot per restaurant — picks the first (lowest spot id) price.
    // Revisit if a multi-spot account is ever onboarded.
    const price = Number(Object.values(raw.price)[0]) / 100;
    if (Number.isNaN(price)) {
      throw new PosterApiError(`Product ${raw.product_id} has no price at any spot`, 0);
    }

    const type = Number(raw.type) as PosterProductType;
    if (type !== 1 && type !== 2 && type !== 3) {
      throw new PosterApiError(
        `Product ${raw.product_id} has an unrecognized type: ${raw.type}`,
        0,
      );
    }

    return {
      productId: Number(raw.product_id),
      name: raw.product_name,
      // menu.getProducts has no description field — see PosterProduct's doc comment.
      description: '',
      price,
      type,
      inStopList: raw.hidden === '1',
    };
  });
}

export async function getProductIngredients(
  token: string,
  productId: number,
): Promise<PosterIngredientRef[]> {
  let response: Response;
  try {
    response = await fetch(
      `${POSTER_BASE_URL}/menu.getProduct?token=${token}&product_id=${productId}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PosterApiError(`Network error calling Poster API: ${message}`, 0);
  }

  if (!response.ok) {
    throw new PosterApiError(
      `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  const { response: detail } = (await response.json()) as {
    response: RawPosterProductDetail;
  };

  // Only тех.карта (recipe) products have an `ingredients` array at all —
  // a товар (retail item) legitimately has none, that's not an error here.
  if (!detail.ingredients) {
    return [];
  }

  return detail.ingredients.map((raw) => ({ name: raw.ingredient_name }));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: PASS (9 tests: 6 for `createIncomingOrder`, 3 for `getProducts`, 4 for `getProductIngredients` — 13 total)

- [ ] **Step 6: Write the failing tests for the reworked `syncMenu`**

Replace the entire contents of `lib/menu/sync.test.ts` with:
```typescript
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncMenu } from './sync';
import type { PosterProduct } from '../poster/types';

describe('syncMenu', () => {
  it('fetches real ingredients for тех.карта items, marks товар items as not applicable, and skips полуфабрикаты', async () => {
    const products: PosterProduct[] = [
      {
        productId: 1,
        name: 'Полуфабрикат теста',
        description: '',
        price: 0,
        type: 1,
        inStopList: false,
      },
      {
        productId: 3,
        name: 'Капучино 250 мл',
        description: '',
        price: 300,
        type: 2,
        inStopList: false,
      },
      {
        productId: 5,
        name: 'Вода минеральная',
        description: '',
        price: 1000,
        type: 3,
        inStopList: false,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi
      .fn()
      .mockResolvedValue([{ name: 'Кофе' }, { name: 'Молоко' }]);

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    await syncMenu(
      supabase as unknown as SupabaseClient,
      { getProducts, getProductIngredients },
      { restaurantId: 'r1', posterToken: 'tok' },
    );

    expect(getProductIngredients).toHaveBeenCalledTimes(1);
    expect(getProductIngredients).toHaveBeenCalledWith('tok', 3);

    const [rows] = upsert.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows).toEqual([
      expect.objectContaining({
        poster_product_id: 3,
        ingredients: [{ name: 'Кофе' }, { name: 'Молоко' }],
        ingredients_known: true,
      }),
      expect.objectContaining({
        poster_product_id: 5,
        ingredients: [],
        ingredients_known: true,
      }),
    ]);
  });

  it('marks a тех.карта with an empty recipe as ingredients_known: false (nobody filled it in yet)', async () => {
    const products: PosterProduct[] = [
      {
        productId: 3,
        name: 'Блюдо без заполненного рецепта',
        description: '',
        price: 300,
        type: 2,
        inStopList: false,
      },
    ];
    const getProducts = vi.fn().mockResolvedValue(products);
    const getProductIngredients = vi.fn().mockResolvedValue([]);

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    await syncMenu(
      supabase as unknown as SupabaseClient,
      { getProducts, getProductIngredients },
      { restaurantId: 'r1', posterToken: 'tok' },
    );

    const [rows] = upsert.mock.calls[0];
    expect(rows[0]).toEqual(expect.objectContaining({ ingredients: [], ingredients_known: false }));
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run lib/menu/sync.test.ts`
Expected: FAIL — `syncMenu`'s current signature takes a single `getProducts`
function, not a `{ getProducts, getProductIngredients }` object.

- [ ] **Step 8: Rewrite the implementation**

Replace the entire contents of `lib/menu/sync.ts` with:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PosterIngredientRef, PosterProduct } from '../poster/types';

type GetProductsFn = (token: string) => Promise<PosterProduct[]>;
type GetProductIngredientsFn = (
  token: string,
  productId: number,
) => Promise<PosterIngredientRef[]>;

export async function syncMenu(
  supabase: SupabaseClient,
  deps: { getProducts: GetProductsFn; getProductIngredients: GetProductIngredientsFn },
  args: { restaurantId: string; posterToken: string },
): Promise<void> {
  const products = await deps.getProducts(args.posterToken);

  const rows = await Promise.all(
    products
      // полуфабрикаты — внутренние компоненты рецептов (например, тесто
      // внутри круассана), не отдельные блюда, которые гость может заказать.
      .filter((product) => product.type !== 1)
      .map(async (product) => {
        let ingredients: PosterIngredientRef[];
        let ingredientsKnown: boolean;

        if (product.type === 2) {
          // тех.карта — реальное блюдо с рецептом. Список меню
          // (menu.getProducts) состав не отдаёт вообще — только отдельный
          // вызов menu.getProduct по каждому товару.
          ingredients = await deps.getProductIngredients(args.posterToken, product.productId);
          ingredientsKnown = ingredients.length > 0;
        } else {
          // товар (например, бутылка воды) — рецепта не предполагается по
          // своей природе, это не пробел в данных, а нормальное состояние.
          ingredients = [];
          ingredientsKnown = true;
        }

        return {
          restaurant_id: args.restaurantId,
          poster_product_id: product.productId,
          name: product.name,
          description: product.description,
          price: product.price,
          ingredients,
          ingredients_known: ingredientsKnown,
          in_stop_list: product.inStopList,
          updated_at: new Date().toISOString(),
        };
      }),
  );

  const { error } = await supabase
    .from('menu_items')
    .upsert(rows, { onConflict: 'restaurant_id,poster_product_id' });

  if (error) {
    throw new Error(`Failed to sync menu: ${error.message}`);
  }
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run lib/menu/sync.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 10: Verify and commit**

Run:
1. `npx vitest run` (full suite) — must all pass
2. `npx tsc --noEmit` — must be clean
3. `npx eslint lib/poster lib/menu` — must be clean

```bash
git add lib/poster/types.ts lib/poster/client.ts lib/poster/client.test.ts lib/menu/sync.ts lib/menu/sync.test.ts
git commit -m "fix: fetch real per-dish ingredients via menu.getProduct (menu.getProducts has none)"
```

---

## What's next (not in this plan)

- **Plan 2 — AI chat + guardrails**: structured per-dish JSON context built
  from `menu_items`, system prompt rules, and the post-response ingredient
  cross-check described in the spec.
- **Plan 3 — Guest ordering UI + table QR generation**: the menu grid +
  chat page that calls `POST /api/orders`, the per-table QR code generator
  for onboarding, and multilingual UI (каз/рус/англ minimum, per the spec).
- **Plan 4 — Onboarding UI + marketplace listing copy**: surfaces the
  Task 7 completeness numbers to the restaurant, and turns the spec's
  positioning section into final app-card and in-UI copy (use the
  `copywriting` skill for this — it's a content task, not a coding one).
