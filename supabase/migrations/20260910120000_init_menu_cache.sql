create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  poster_spot_id integer not null unique,
  poster_token text not null,
  created_at timestamptz not null default now()
);

comment on column restaurants.poster_token is
  'Plaintext Poster API token — known gap, tracked in docs/superpowers/specs/2026-09-10-poster-ai-menu-design.md. '
  'Only service-role server code reads this table today (no RLS/anon-key path yet), which bounds exposure, '
  'but encrypt via Supabase Vault before onboarding real paying restaurants.';

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

-- No separate index on menu_items(restaurant_id): the composite unique
-- constraint above already provides one via its leftmost column, so a
-- standalone index here would only add write overhead with no query benefit.
