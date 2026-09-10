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
