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
