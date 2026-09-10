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
