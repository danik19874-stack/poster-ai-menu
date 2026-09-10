# Guest Ordering UI — Categories, Table QR, Cart (Plan 3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only menu preview (real synced menu + dish detail +
placeholder ask-about-composition field, built in Plan 1's live-test round)
into an actually orderable guest flow: dishes grouped by category, a
per-table permanent QR link, a cart, and an order-submission screen that
calls the already-working `POST /api/orders` → `createTableOrder` →
Poster `incomingOrders.createIncomingOrder` path built in Plan 1.

**Architecture:** Pure, unit-tested logic (category grouping, cart math)
lives in plain TypeScript modules under `lib/`, independent of React —
matching the project's existing split (`lib/menu/sync.ts`,
`lib/orders/createTableOrder.ts`) since there is no React component test
runner in this project and none is being added for this plan. React only
wires that logic to `localStorage` and fetch calls; that wiring is not
unit-tested, same convention already used for `AskAboutDish.tsx`.

**Verified against the real connected Poster account (11.09.2026, live
`menu.getProducts` call) before writing this plan:** the category field is
`category_name` (string, e.g. `"Холодные напитки"`), confirmed via a direct
curl against the real synced restaurant — not assumed from docs. The test
account has 3 distinct categories among its products.

**URL shape:** `/menu-preview/{restaurantId}/{itemId}?table={label}` —
`restaurantId` is the existing `restaurants.id` UUID (no new slug concept;
guests never read the URL, they scan a printed QR). `table` is a free-text
label (matches `tableLabel: string` already accepted by
`createTableOrder`), one fixed QR code printed per physical table,
encoding both restaurant and table so it keeps working once a second
restaurant is onboarded — today's code silently assumes there is exactly
one restaurant in the whole database (`.single()` with no filter), which
this plan also fixes as a side effect of adding the restaurant segment.

**Cart persistence:** `localStorage`, keyed `cart:{restaurantId}:{table}`,
per the owner's explicit choice (no guest login). Cleared on successful
order submission.

**Category display:** items are always grouped by `category_name` server-side
(via a pure, tested function); the page only renders category headers when
there is more than one distinct category — a restaurant with one category
or none renders as a plain flat list, no empty/pointless headers. No
per-restaurant setting; this is automatic based on what's actually in
their Poster catalog.

**Tech Stack:** unchanged from Plan 1 — Next.js App Router (TypeScript),
Supabase Postgres (service-role, server-only), Vitest.

---

## Task 1: Store the dish's category from Poster

**Files:**
- Create: `supabase/migrations/20260911010000_add_menu_item_category.sql`
- Modify: `lib/poster/types.ts`
- Modify: `lib/poster/client.ts`
- Modify: `lib/poster/client.test.ts`
- Modify: `lib/menu/sync.ts`
- Modify: `lib/menu/sync.test.ts`

- [ ] **Step 1: Write the failing test for `getProducts` returning category**

Add to `lib/poster/client.test.ts`, inside the existing `describe('getProducts', ...)` block (extend the existing mock fixture rather than duplicating the whole test — find the existing "maps a Poster product to our domain shape" test and add `category_name: 'Кофе'` to its mock input and `categoryName: 'Кофе'` to its expected output). Also add a dedicated test:

```typescript
it('treats a missing or blank category_name as null', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: [
          {
            product_id: '9',
            product_name: 'Товар без категории',
            category_name: '',
            price: { '1': '50000' },
            type: '3',
            hidden: '0',
            photo: '',
          },
        ],
      }),
    }),
  );

  const products = await getProducts('token');

  expect(products[0].categoryName).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: FAIL — `categoryName` is `undefined`, not present on the mapped object / test file doesn't compile because `PosterProduct` has no `categoryName` field yet.

- [ ] **Step 3: Add `categoryName` to the domain type**

In `lib/poster/types.ts`, add to `PosterProduct`:

```typescript
  /** Poster's free-text category name (e.g. "Кофе"). Null if Poster has no category set for this product. */
  categoryName: string | null;
```

(Add this field to the `PosterProduct` interface, after `description`.)

- [ ] **Step 4: Map `category_name` in `getProducts`**

In `lib/poster/client.ts`:

Add `category_name: string;` to the `RawPosterProduct` interface.

In the `.map((raw) => ...)` body inside `getProducts`, add:

```typescript
          categoryName: raw.category_name && raw.category_name.trim() ? raw.category_name : null,
```

(as a new property in the returned object, next to `description: ''`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/poster/client.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Write the failing test for `syncMenu` persisting category**

In `lib/menu/sync.test.ts`, find the existing fixture products used in the
main "syncs products, filters полуфабрикаты, fetches real ingredients"
test. Add `categoryName: 'Кофе'` to one fixture product and assert the
upserted row for that product includes `category_name: 'Кофе'`. Add
`categoryName: null` to another existing fixture and assert its row has
`category_name: null`.

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run lib/menu/sync.test.ts`
Expected: FAIL — upserted row has no `category_name` key yet.

- [ ] **Step 8: Persist category in `syncMenu`**

In `lib/menu/sync.ts`:

Add `category_name: string | null;` to the `MenuItemRow` interface.

In the `rows.push({...})` call, add:

```typescript
          category_name: product.categoryName,
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run lib/menu/sync.test.ts`
Expected: PASS.

- [ ] **Step 10: Write and apply the migration**

Create `supabase/migrations/20260911010000_add_menu_item_category.sql`:

```sql
-- Poster's menu.getProducts returns a category_name per product (verified
-- live 11.09.2026: e.g. "Кофе", "Холодные напитки"). Needed to group the
-- guest-facing menu by category instead of one flat list.
alter table menu_items
  add column category_name text;
```

Apply it against the real Supabase project via the Management API (same
method used for the `photo_url` migration in Plan 1), then verify with:

```sql
select column_name from information_schema.columns
where table_name = 'menu_items' and column_name = 'category_name';
```

Expected: one row returned.

- [ ] **Step 11: Re-sync the real connected restaurant**

Run the existing one-off sync script (same one used to populate photos in
Plan 1) against the real account so existing rows get `category_name`
backfilled — a plain re-run of `syncMenu`, no new script needed.

- [ ] **Step 12: Commit**

```bash
git add supabase/migrations/20260911010000_add_menu_item_category.sql lib/poster/types.ts lib/poster/client.ts lib/poster/client.test.ts lib/menu/sync.ts lib/menu/sync.test.ts
git commit -m "feat: sync each dish's Poster category_name"
```

---

## Task 2: Group menu items by category (pure logic)

**Files:**
- Create: `lib/menu/groupByCategory.ts`
- Create: `lib/menu/groupByCategory.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/menu/groupByCategory.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { groupByCategory } from './groupByCategory';

interface Item {
  id: string;
  category_name: string | null;
}

describe('groupByCategory', () => {
  it('returns a single group when every item shares one category', () => {
    const items: Item[] = [
      { id: '1', category_name: 'Кофе' },
      { id: '2', category_name: 'Кофе' },
    ];

    const groups = groupByCategory(items);

    expect(groups).toEqual([{ category: 'Кофе', items }]);
  });

  it('groups items into sorted-by-name categories, preserving item order within each', () => {
    const cola = { id: '1', category_name: 'Напитки' };
    const cappuccino = { id: '2', category_name: 'Кофе' };
    const latte = { id: '3', category_name: 'Кофе' };

    const groups = groupByCategory([cola, cappuccino, latte]);

    expect(groups).toEqual([
      { category: 'Кофе', items: [cappuccino, latte] },
      { category: 'Напитки', items: [cola] },
    ]);
  });

  it('buckets items with no category under a null group placed last', () => {
    const withCategory = { id: '1', category_name: 'Кофе' };
    const withoutCategory = { id: '2', category_name: null };
    const withBlankCategory = { id: '3', category_name: '' };

    const groups = groupByCategory([withoutCategory, withCategory, withBlankCategory]);

    expect(groups).toEqual([
      { category: 'Кофе', items: [withCategory] },
      { category: null, items: [withoutCategory, withBlankCategory] },
    ]);
  });

  it('returns an empty array for an empty menu', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/menu/groupByCategory.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `groupByCategory`**

Create `lib/menu/groupByCategory.ts`:

```typescript
interface CategorizedItem {
  category_name: string | null;
}

export interface MenuCategoryGroup<T> {
  category: string | null;
  items: T[];
}

export function groupByCategory<T extends CategorizedItem>(items: T[]): MenuCategoryGroup<T>[] {
  const groups = new Map<string | null, T[]>();

  for (const item of items) {
    const key = item.category_name && item.category_name.trim() ? item.category_name : null;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b, 'ru');
    })
    .map(([category, categoryItems]) => ({ category, items: categoryItems }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/menu/groupByCategory.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add lib/menu/groupByCategory.ts lib/menu/groupByCategory.test.ts
git commit -m "feat: add pure category-grouping logic for the guest menu"
```

---

## Task 3: Cart math (pure logic)

**Files:**
- Create: `lib/cart/cartReducer.ts`
- Create: `lib/cart/cartReducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/cart/cartReducer.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { addItem, cartTotal, removeItem, setQty } from './cartReducer';
import type { CartItem } from './cartReducer';

const croissant: CartItem = { productId: 1, menuItemId: 'a', name: 'Круассан', price: 1200, qty: 1 };
const latte: CartItem = { productId: 2, menuItemId: 'b', name: 'Латте', price: 1500, qty: 1 };

describe('addItem', () => {
  it('appends a new product with qty 1', () => {
    expect(addItem([], croissant)).toEqual([croissant]);
  });

  it('increments qty when the product is already in the cart', () => {
    const result = addItem([croissant], croissant);
    expect(result).toEqual([{ ...croissant, qty: 2 }]);
  });

  it('leaves other items untouched', () => {
    const result = addItem([croissant, latte], croissant);
    expect(result).toEqual([{ ...croissant, qty: 2 }, latte]);
  });
});

describe('setQty', () => {
  it('updates the qty of the matching product', () => {
    expect(setQty([croissant], 1, 3)).toEqual([{ ...croissant, qty: 3 }]);
  });

  it('removes the item when qty is set to 0', () => {
    expect(setQty([croissant, latte], 1, 0)).toEqual([latte]);
  });
});

describe('removeItem', () => {
  it('drops the matching product', () => {
    expect(removeItem([croissant, latte], 1)).toEqual([latte]);
  });

  it('is a no-op when the product is not in the cart', () => {
    expect(removeItem([latte], 999)).toEqual([latte]);
  });
});

describe('cartTotal', () => {
  it('sums price times qty across all items', () => {
    expect(cartTotal([croissant, { ...latte, qty: 2 }])).toBe(1200 * 1 + 1500 * 2);
  });

  it('is 0 for an empty cart', () => {
    expect(cartTotal([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/cart/cartReducer.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `cartReducer`**

Create `lib/cart/cartReducer.ts`:

```typescript
export interface CartItem {
  productId: number;
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
}

export function addItem(cart: CartItem[], item: CartItem): CartItem[] {
  const existing = cart.find((entry) => entry.productId === item.productId);
  if (!existing) {
    return [...cart, item];
  }
  return cart.map((entry) =>
    entry.productId === item.productId ? { ...entry, qty: entry.qty + item.qty } : entry,
  );
}

export function setQty(cart: CartItem[], productId: number, qty: number): CartItem[] {
  if (qty <= 0) {
    return removeItem(cart, productId);
  }
  return cart.map((entry) => (entry.productId === productId ? { ...entry, qty } : entry));
}

export function removeItem(cart: CartItem[], productId: number): CartItem[] {
  return cart.filter((entry) => entry.productId !== productId);
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, entry) => sum + entry.price * entry.qty, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/cart/cartReducer.test.ts`
Expected: PASS, 8/8.

- [ ] **Step 5: Commit**

```bash
git add lib/cart/cartReducer.ts lib/cart/cartReducer.test.ts
git commit -m "feat: add pure cart math (add/remove/setQty/total)"
```

---

## Task 4: Move menu-preview under `[restaurantId]`, thread `table` through

**Files:**
- Create: `app/menu-preview/[restaurantId]/page.tsx` (replaces `app/menu-preview/page.tsx`)
- Create: `app/menu-preview/[restaurantId]/menu.module.css` (moved from `app/menu-preview/menu.module.css`)
- Create: `app/menu-preview/[restaurantId]/[itemId]/page.tsx` (replaces `app/menu-preview/[itemId]/page.tsx`)
- Create: `app/menu-preview/[restaurantId]/[itemId]/AskAboutDish.tsx` (moved, unchanged)
- Create: `app/menu-preview/[restaurantId]/[itemId]/detail.module.css` (moved, unchanged)
- Delete: `app/menu-preview/page.tsx`, `app/menu-preview/menu.module.css`, `app/menu-preview/[itemId]/` (whole old folder)

This task is a restructure of already-working, already-tested-by-hand
pages — no new business logic, so no new unit tests. Verification is a
manual browser check at the end (Step 6).

- [ ] **Step 1: Move the CSS and the ask-widget files unchanged**

Move `app/menu-preview/menu.module.css` → `app/menu-preview/[restaurantId]/menu.module.css` (identical content).

Move `app/menu-preview/[itemId]/AskAboutDish.tsx` → `app/menu-preview/[restaurantId]/[itemId]/AskAboutDish.tsx` (identical content, it has no path-dependent imports).

Move `app/menu-preview/[itemId]/detail.module.css` → `app/menu-preview/[restaurantId]/[itemId]/detail.module.css` (identical content).

Add one class to the moved `menu.module.css` for the category header (append at the end of the file):

```css
.categoryHeader {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-soft);
  margin: 24px 20px 10px;
}

.categoryHeader:first-child {
  margin-top: 0;
}
```

- [ ] **Step 2: Write the new list page**

Create `app/menu-preview/[restaurantId]/page.tsx`:

```tsx
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { groupByCategory } from "@/lib/menu/groupByCategory";
import CartBar from "./CartBar";
import styles from "./menu.module.css";

export default async function MenuPreview({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { restaurantId } = await params;
  const { table } = await searchParams;
  const supabase = getSupabaseServerClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .single();

  const items = restaurant
    ? (
        await supabase
          .from("menu_items")
          .select("id, name, description, price, ingredients_known, photo_url, category_name")
          .eq("restaurant_id", restaurant.id)
          .order("name")
      ).data ?? []
    : [];

  const groups = groupByCategory(items);
  const showHeaders = groups.length > 1;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <span className={styles.eyebrow}>Реальное меню · подключено через Poster</span>
        <h1 className={styles.restaurantName}>{restaurant?.name ?? "Меню не подключено"}</h1>
        <p className={styles.restaurantMeta}>
          {table ? `Стол ${table}` : "Стол не определён"} · меню синхронизировано с кассой
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.category ?? "_none"} className={styles.section}>
          {showHeaders && group.category && (
            <p className={styles.categoryHeader}>{group.category}</p>
          )}
          <div className={styles.list}>
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={`/menu-preview/${restaurantId}/${item.id}${table ? `?table=${table}` : ""}`}
                className={styles.row}
              >
                <div className={styles.rowMain}>
                  <p className={styles.rowName}>{item.name}</p>
                  <p className={styles.rowDesc}>
                    {item.description || "Описание уточняется у заведения"}
                  </p>
                  <div className={styles.rowFooter}>
                    <span className={styles.price}>{item.price} ₸</span>
                    {!item.ingredients_known && (
                      <span className={styles.badgeMuted}>Состав уточняется</span>
                    )}
                  </div>
                </div>
                <div className={styles.photo} aria-hidden="true">
                  {item.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photo_url} alt="" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {items.length === 0 && (
        <p className={styles.rowDesc} style={{ padding: "18px 20px" }}>
          Меню пока пустое — синхронизация с Poster ещё не выполнялась.
        </p>
      )}

      <CartBar restaurantId={restaurantId} table={table} />
    </div>
  );
}
```

(`CartBar` is built in Task 6 — this page imports it now so Task 6 only
has to create the file, not touch this one again.)

- [ ] **Step 3: Write the new detail page**

Create `app/menu-preview/[restaurantId]/[itemId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import AskAboutDish from "./AskAboutDish";
import AddToCart from "./AddToCart";
import styles from "./detail.module.css";

interface IngredientRef {
  name: string;
}

export default async function DishDetail({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string; itemId: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { restaurantId, itemId } = await params;
  const { table } = await searchParams;
  const supabase = getSupabaseServerClient();

  const { data: item } = await supabase
    .from("menu_items")
    .select("id, poster_product_id, name, description, price, ingredients, ingredients_known, photo_url")
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (!item) {
    notFound();
  }

  const ingredients = (item.ingredients as IngredientRef[] | null) ?? [];
  const backHref = `/menu-preview/${restaurantId}${table ? `?table=${table}` : ""}`;

  return (
    <div className={styles.page}>
      <Link href={backHref} className={styles.back}>
        ← Назад в меню
      </Link>

      <div className={styles.photo} aria-hidden="true">
        {item.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo_url} alt="" />
        )}
      </div>

      <div className={styles.body}>
        <h1 className={styles.name}>{item.name}</h1>
        <div className={styles.priceRow}>
          <span className={styles.price}>{item.price} ₸</span>
        </div>
        <p className={styles.description}>
          {item.description || "Описание уточняется у заведения"}
        </p>

        <div className={styles.ingredientsBlock}>
          <p className={styles.ingredientsTitle}>Состав</p>
          {item.ingredients_known && ingredients.length > 0 ? (
            <ul className={styles.ingredientsList}>
              {ingredients.map((ingredient) => (
                <li key={ingredient.name} className={styles.ingredientChip}>
                  {ingredient.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.unknownNotice}>
              Точный состав пока не подтверждён заведением — уточните у официанта.
            </p>
          )}
        </div>

        <AddToCart
          table={table}
          productId={item.poster_product_id}
          menuItemId={item.id}
          name={item.name}
          price={item.price}
        />
      </div>

      <AskAboutDish
        dishName={item.name}
        ingredientsKnown={item.ingredients_known}
        ingredientNames={ingredients.map((i) => i.name)}
      />
    </div>
  );
}
```

(`AddToCart` is built in Task 6.) Note the added `.eq("restaurant_id", restaurantId)` on the item lookup — without it, any `itemId` UUID would resolve regardless of which restaurant's URL segment it was opened under, which becomes an actual cross-restaurant data leak once a second restaurant is onboarded (today the code has only ever had one restaurant in the whole database, so this bug had no way to manifest yet).

- [ ] **Step 4: Delete the old, now-unused files**

```bash
git rm app/menu-preview/page.tsx app/menu-preview/menu.module.css
git rm -r app/menu-preview/\[itemId\]
```

- [ ] **Step 5: Confirm it builds**

Run: `npx tsc --noEmit`
Expected: no errors from these files (Task 6's `CartBar`/`AddToCart` imports will still be unresolved until Task 6 — that's expected and fixed there; if the project's `tsc` config fails the whole build on any unresolved import, skip this check here and run it at the end of Task 6 instead).

- [ ] **Step 6: Commit**

```bash
git add app/menu-preview
git commit -m "refactor: scope the guest menu under /menu-preview/{restaurantId}, thread ?table= through"
```

---

## Task 5: Cart context (client-side, localStorage-backed)

**Files:**
- Create: `app/menu-preview/[restaurantId]/CartContext.tsx`

This is thin wiring around the already-tested `lib/cart/cartReducer.ts` —
no new unit tests, same convention as `AskAboutDish.tsx`.

- [ ] **Step 1: Implement the cart context**

Create `app/menu-preview/[restaurantId]/CartContext.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CartItem } from "@/lib/cart/cartReducer";
import { addItem, cartTotal, removeItem, setQty } from "@/lib/cart/cartReducer";

interface CartContextValue {
  items: CartItem[];
  total: number;
  table: string | null;
  add: (item: CartItem) => void;
  updateQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(restaurantId: string, table: string) {
  return `cart:${restaurantId}:${table}`;
}

export function CartProvider({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: React.ReactNode;
}) {
  const table = useSearchParams().get("table");
  const [items, setItems] = useState<CartItem[]>([]);

  // Table can only be known once we're on the client (search params), so the
  // cart is empty on first server-rendered paint and hydrates from
  // localStorage right after — matches the rest of this page, which is
  // already fully client/browser-driven for anything cart-related.
  useEffect(() => {
    if (!table) return;
    try {
      const raw = localStorage.getItem(storageKey(restaurantId, table));
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
  }, [restaurantId, table]);

  function persist(next: CartItem[]) {
    setItems(next);
    if (!table) return;
    try {
      localStorage.setItem(storageKey(restaurantId, table), JSON.stringify(next));
    } catch {
      // localStorage unavailable (private mode, quota) — cart still works for this page view
    }
  }

  const value: CartContextValue = {
    items,
    total: cartTotal(items),
    table,
    add: (item) => persist(addItem(items, item)),
    updateQty: (productId, qty) => persist(setQty(items, productId, qty)),
    remove: (productId) => persist(removeItem(items, productId)),
    clear: () => persist([]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: Wrap the `[restaurantId]` segment in the provider**

Create `app/menu-preview/[restaurantId]/layout.tsx`:

```tsx
import { CartProvider } from "./CartContext";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return <CartProvider restaurantId={restaurantId}>{children}</CartProvider>;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/menu-preview/[restaurantId]/CartContext.tsx app/menu-preview/[restaurantId]/layout.tsx
git commit -m "feat: add localStorage-backed cart context, scoped per restaurant+table"
```

---

## Task 6: Add-to-cart button and cart summary bar

**Files:**
- Create: `app/menu-preview/[restaurantId]/[itemId]/AddToCart.tsx`
- Create: `app/menu-preview/[restaurantId]/CartBar.tsx`
- Modify: `app/menu-preview/[restaurantId]/[itemId]/detail.module.css`
- Modify: `app/menu-preview/[restaurantId]/menu.module.css`

Thin UI wiring, no new unit tests — verified by hand in Step 4.

- [ ] **Step 1: Implement `AddToCart`**

Create `app/menu-preview/[restaurantId]/[itemId]/AddToCart.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useCart } from "../CartContext";
import styles from "./detail.module.css";

export default function AddToCart({
  table,
  productId,
  menuItemId,
  name,
  price,
}: {
  table?: string;
  productId: number;
  menuItemId: string;
  name: string;
  price: number;
}) {
  const cart = useCart();
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    cart.add({ productId, menuItemId, name, price, qty: 1 });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  if (!table) {
    return (
      <p className={styles.unknownNotice}>
        Номер стола не определён — отсканируйте QR-код на столе ещё раз.
      </p>
    );
  }

  return (
    <button type="button" className={styles.addButton} onClick={handleAdd}>
      {justAdded ? "Добавлено ✓" : "Добавить в заказ"}
    </button>
  );
}
```

`productId` is Poster's real numeric product id (`poster_product_id`,
fetched by the detail page in Task 4 Step 3), not the Supabase UUID —
that's the value `CreateIncomingOrderItem.productId` actually needs when
the cart is submitted in Task 7. `menuItemId` (the Supabase UUID) is kept
on the cart item only for potential future display/back-navigation use,
matching what `CartItem` already declares.

- [ ] **Step 2: Implement `CartBar`**

Create `app/menu-preview/[restaurantId]/CartBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useCart } from "./CartContext";
import styles from "./menu.module.css";

export default function CartBar({
  restaurantId,
  table,
}: {
  restaurantId: string;
  table?: string;
}) {
  const cart = useCart();

  if (cart.items.length === 0) return null;

  const count = cart.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className={styles.askBar}>
      <Link
        href={`/menu-preview/${restaurantId}/cart${table ? `?table=${table}` : ""}`}
        className={styles.askPill}
      >
        <span>
          {count} {count === 1 ? "блюдо" : "блюда"} · {cart.total} ₸
        </span>
        <span>Просмотреть заказ →</span>
      </Link>
    </div>
  );
}
```

(Reuses the existing `.askBar`/`.askPill` sticky-bottom styles already in
`menu.module.css`, which were designed but never wired up to anything.)

- [ ] **Step 3: Add the `.addButton` style**

Append to `app/menu-preview/[restaurantId]/[itemId]/detail.module.css`:

```css
.addButton {
  width: 100%;
  margin-top: 20px;
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 15px;
  padding: 14px;
  border-radius: 14px;
  cursor: pointer;
}

.addButton:active {
  transform: scale(0.98);
}
```

- [ ] **Step 4: Manual verification in the browser**

Using `dev-browser` against the running dev server: open the real
restaurant's menu URL with a `?table=` param, confirm category headers
show (3 categories in the real test account) and the flat-list fallback
still renders correctly for a single-category slice if tested against
filtered data. Open a dish, click "Добавить в заказ", confirm the cart bar
appears at the bottom of the list page with the right count/total,
confirm it persists across a page reload (localStorage).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green, no type errors.

- [ ] **Step 6: Commit**

```bash
git add app/menu-preview
git commit -m "feat: add add-to-cart button and cart summary bar"
```

---

## Task 7: Cart / checkout screen

**Files:**
- Create: `app/menu-preview/[restaurantId]/cart/page.tsx`
- Create: `app/menu-preview/[restaurantId]/cart/cart.module.css`

No new pure logic here (submission is a fetch call + existing, already-
tested `/api/orders` route) — no new unit tests, manual verification in
Step 2.

- [ ] **Step 1: Implement the cart page**

Create `app/menu-preview/[restaurantId]/cart/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "../CartContext";
import styles from "./cart.module.css";

export default function CartPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const cart = useCart();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [orderId, setOrderId] = useState<number | null>(null);

  // params is a Promise in this Next.js version even in client components;
  // resolve it once on mount rather than making the whole component async
  // (client components can't be async functions).
  useState(() => {
    params.then((p) => setRestaurantId(p.restaurantId));
  });

  const menuHref = restaurantId
    ? `/menu-preview/${restaurantId}${cart.table ? `?table=${cart.table}` : ""}`
    : "#";

  if (status === "done" && orderId !== null) {
    return (
      <div className={styles.page}>
        <div className={styles.confirmation}>
          <p className={styles.confirmationTitle}>Заказ №{orderId} отправлен</p>
          <p className={styles.confirmationText}>
            Официант уже видит его на кассе и подтвердит за несколько секунд — дальше блюда
            уходят на кухню. Ждать у стола не нужно.
          </p>
          <Link href={menuHref} className={styles.backLink}>
            ← Вернуться в меню
          </Link>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Корзина пуста — выберите блюда в меню.</p>
        <Link href={menuHref} className={styles.backLink}>
          ← В меню
        </Link>
      </div>
    );
  }

  async function submit() {
    if (!restaurantId || !cart.table) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          tableLabel: cart.table,
          items: cart.items.map((item) => ({ productId: item.productId, count: item.qty })),
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { posterIncomingOrderId: number };
      setOrderId(data.posterIncomingOrderId);
      cart.clear();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={styles.page}>
      <Link href={menuHref} className={styles.backLink}>
        ← В меню
      </Link>
      <h1 className={styles.title}>Ваш заказ</h1>

      {!cart.table && (
        <p className={styles.warning}>
          Номер стола не определён — отсканируйте QR-код на столе ещё раз, иначе заказ отправить
          не получится.
        </p>
      )}

      <ul className={styles.list}>
        {cart.items.map((item) => (
          <li key={item.productId} className={styles.row}>
            <div>
              <p className={styles.name}>{item.name}</p>
              <p className={styles.price}>{item.price} ₸</p>
            </div>
            <div className={styles.qtyControl}>
              <button type="button" onClick={() => cart.updateQty(item.productId, item.qty - 1)}>
                −
              </button>
              <span>{item.qty}</span>
              <button type="button" onClick={() => cart.updateQty(item.productId, item.qty + 1)}>
                +
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.totalRow}>
        <span>Итого</span>
        <span>{cart.total} ₸</span>
      </div>

      {status === "error" && (
        <p className={styles.warning}>Не получилось отправить заказ. Попробуйте ещё раз.</p>
      )}

      <button
        type="button"
        className={styles.submitButton}
        disabled={!cart.table || status === "submitting"}
        onClick={submit}
      >
        {status === "submitting" ? "Отправляем…" : "Оформить заказ"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add the cart page styles**

Create `app/menu-preview/[restaurantId]/cart/cart.module.css`:

```css
.page {
  min-height: 100vh;
  background: var(--background);
  padding: 16px 20px 32px;
}

.backLink {
  display: inline-flex;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-soft);
  margin-bottom: 16px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 20px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0;
  list-style: none;
  padding: 0;
  margin: 0;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.name {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
}

.price {
  font-variant-numeric: tabular-nums;
  font-size: 13.5px;
  color: var(--ink-soft);
  margin: 0;
}

.qtyControl {
  display: flex;
  align-items: center;
  gap: 12px;
}

.qtyControl button {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 16px;
  cursor: pointer;
}

.qtyControl span {
  font-variant-numeric: tabular-nums;
  min-width: 16px;
  text-align: center;
}

.totalRow {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 17px;
  padding: 20px 0;
}

.submitButton {
  width: 100%;
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 15px;
  padding: 16px;
  border-radius: 14px;
  cursor: pointer;
}

.submitButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.warning {
  font-size: 14px;
  color: var(--ink-soft);
  background: var(--accent-soft);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.empty {
  font-size: 15px;
  color: var(--ink-soft);
  margin-bottom: 16px;
}

.confirmation {
  padding-top: 60px;
  text-align: center;
}

.confirmationTitle {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 12px;
}

.confirmationText {
  font-size: 15px;
  color: var(--ink-soft);
  line-height: 1.5;
  margin: 0 0 24px;
}
```

- [ ] **Step 3: Manual end-to-end verification in the browser**

Using `dev-browser` against the running dev server, with the real
connected restaurant: open the menu with `?table=`, add two different
dishes, open the cart, change a quantity, submit the order, confirm the
confirmation screen shows a real Poster incoming order id (check it
against the Poster account's incoming orders), confirm the cart is empty
on a fresh visit to the menu afterward. Also test the `?table=` missing
case (warning shown, submit disabled) and a submit failure path if
feasible (e.g. temporarily wrong token) to confirm the error state doesn't
silently drop the cart.

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit && npx eslint app lib`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/menu-preview/[restaurantId]/cart
git commit -m "feat: add cart/checkout screen with order submission and confirmation"
```

---

## Verification

- `npx vitest run` — all tests green, including the new
  `groupByCategory`, `cartReducer`, and extended `client`/`sync` tests, no
  regressions in Plan 1's existing suite.
- `npx tsc --noEmit` and `npx eslint app lib` clean.
- Manual browser walkthrough (Task 6 Step 4, Task 7 Step 3) against the
  real connected Poster account: category headers appear, add-to-cart
  works, cart persists across reloads, order submission produces a real
  Poster incoming order, confirmation and error states both render
  correctly, and the missing-`?table=` guard actually blocks submission.
- Dated note in `CLAUDE.md` after the manual walkthrough passes — project
  precedent: green tests alone don't count as proof a guest-facing flow
  actually works end to end in the browser.
