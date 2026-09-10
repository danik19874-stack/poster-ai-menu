# Poster API Integration — Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational backend layer that talks to Poster POS —
fetch menu/ingredients, cache them, compute ingredient-completeness, and
create a table-bound auto-accepted order — with no UI and no AI chat yet.
Everything else in the spec (guest chat, AI guardrails, onboarding checker
UI, marketplace listing copy) is a separate follow-up plan and depends on
this one working and tested first.

**Architecture:** A Next.js (App Router, TypeScript) app with server-only
API routes. A thin, fully-typed Poster API client wraps the two relevant
endpoints (`GET /api/menu.getProducts` + `.getIngredients`, `POST
/api/orders`). A Supabase Postgres database caches each restaurant's menu
server-side so the (future) guest-facing chat never calls Poster directly
per request. All Poster tokens and Supabase service-role access stay
server-side; the guest browser only ever talks to our own Next.js API.

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

### Task 3: Poster API client — `createOrder`

**Files:**
- Create: `lib/poster/client.ts`
- Test: `lib/poster/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/poster/client.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOrder } from './client';
import { PosterApiError } from './types';

describe('createOrder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends tableId and autoAccept:true so the order lands on the kitchen without staff confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: { id: 156, status: 1, spotId: 42, tableId: 17 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createOrder('test-token', {
      spotId: 42,
      tableId: 17,
      serviceMode: 1,
      autoAccept: true,
      products: [{ productId: 169, count: 2 }],
    });

    expect(result.response.id).toBe(156);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://joinposter.com/api/orders?token=test-token');
    const body = JSON.parse(options.body as string);
    expect(body.tableId).toBe(17);
    expect(body.autoAccept).toBe(true);
    expect(body.serviceMode).toBe(1);
  });

  it('throws PosterApiError when Poster returns a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Table not found' } }),
      }),
    );

    await expect(
      createOrder('test-token', {
        spotId: 42,
        tableId: 999,
        serviceMode: 1,
        autoAccept: true,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toThrow(PosterApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: FAIL — `Cannot find module './client'` (file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/poster/client.ts`:
```typescript
import type { CreateOrderRequest, CreateOrderResponse } from './types';
import { PosterApiError } from './types';

const POSTER_BASE_URL = 'https://joinposter.com/api';

export async function createOrder(
  token: string,
  order: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  const response = await fetch(`${POSTER_BASE_URL}/orders?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new PosterApiError(
      body?.error?.message ?? `Poster API request failed with status ${response.status}`,
      response.status,
    );
  }

  return response.json();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/poster/client.ts lib/poster/client.test.ts
git commit -m "feat: add Poster createOrder client with autoAccept support"
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

### Task 8: Order creation API route

**Files:**
- Create: `lib/orders/createTableOrder.ts`
- Test: `lib/orders/createTableOrder.test.ts`
- Create: `app/api/orders/route.ts`

This is the task that fulfils the spec's core claim: a guest order placed
against a specific table becomes a Poster order with `autoAccept: true`,
with no staff confirmation step. The Next.js route stays a thin wrapper;
the logic is in a plain function so it's testable without spinning up an
HTTP server.

- [ ] **Step 1: Write the failing test**

Create `lib/orders/createTableOrder.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { createTableOrder } from './createTableOrder';

describe('createTableOrder', () => {
  it('looks up the restaurant, then creates an auto-accepted dine-in order for that table', async () => {
    const getRestaurant = vi.fn().mockResolvedValue({
      posterSpotId: 42,
      posterToken: 'tok',
    });
    const createOrder = vi.fn().mockResolvedValue({
      response: { id: 156, status: 1, spotId: 42, tableId: 17 },
    });

    const result = await createTableOrder(
      { getRestaurant, createOrder },
      {
        restaurantId: 'r1',
        tableId: 17,
        items: [{ productId: 169, count: 2 }],
      },
    );

    expect(getRestaurant).toHaveBeenCalledWith('r1');
    expect(createOrder).toHaveBeenCalledWith('tok', {
      spotId: 42,
      tableId: 17,
      serviceMode: 1,
      autoAccept: true,
      products: [{ productId: 169, count: 2 }],
    });
    expect(result).toEqual({ posterOrderId: 156 });
  });

  it('rejects an empty item list before calling Poster at all', async () => {
    const getRestaurant = vi.fn();
    const createOrder = vi.fn();

    await expect(
      createTableOrder(
        { getRestaurant, createOrder },
        { restaurantId: 'r1', tableId: 17, items: [] },
      ),
    ).rejects.toThrow('at least one item');
    expect(getRestaurant).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/orders/createTableOrder.test.ts`
Expected: FAIL — `Cannot find module './createTableOrder'`

- [ ] **Step 3: Write the minimal implementation**

Create `lib/orders/createTableOrder.ts`:
```typescript
import type { CreateOrderItem, CreateOrderResponse } from '../poster/types';

interface RestaurantLookup {
  posterSpotId: number;
  posterToken: string;
}

interface Deps {
  getRestaurant: (restaurantId: string) => Promise<RestaurantLookup>;
  createOrder: (
    token: string,
    order: {
      spotId: number;
      tableId: number;
      serviceMode: 1;
      autoAccept: true;
      products: CreateOrderItem[];
    },
  ) => Promise<CreateOrderResponse>;
}

interface CreateTableOrderArgs {
  restaurantId: string;
  tableId: number;
  items: CreateOrderItem[];
}

export async function createTableOrder(
  deps: Deps,
  args: CreateTableOrderArgs,
): Promise<{ posterOrderId: number }> {
  if (args.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  const restaurant = await deps.getRestaurant(args.restaurantId);

  const result = await deps.createOrder(restaurant.posterToken, {
    spotId: restaurant.posterSpotId,
    tableId: args.tableId,
    serviceMode: 1,
    autoAccept: true,
    products: args.items,
  });

  return { posterOrderId: result.response.id };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/orders/createTableOrder.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the Next.js route (thin wrapper, no new logic to test)**

Create `app/api/orders/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTableOrder } from '@/lib/orders/createTableOrder';
import { createOrder as posterCreateOrder } from '@/lib/poster/client';

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
      { getRestaurant, createOrder: posterCreateOrder },
      {
        restaurantId: body.restaurantId,
        tableId: body.tableId,
        items: body.items,
      },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
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
git commit -m "feat: add table order creation endpoint (autoAccept, no staff confirmation)"
```

---

### Task 9: Run the full suite before calling Plan 1 done

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests across `lib/poster`, `lib/menu`, `lib/orders` PASS,
0 failures.

- [ ] **Step 2: Manual smoke check against the real Poster sandbox**

Using a real (or Poster-provided test) token and spot, call
`getProducts` and `createOrder` directly (e.g. via a scratch script) to
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
