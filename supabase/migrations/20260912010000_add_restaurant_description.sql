-- Poster's own API (spots.getSpots) has no description/cuisine field at all —
-- verified live against the connected account on 12.09.2026. This has to be
-- entered by the restaurant owner themselves; it's used to greet guests and
-- give the AI chat a little more identity/context, never invented by us.
alter table restaurants
  add column description text not null default '';

comment on column restaurants.description is
  'Owner-entered free text (e.g. cuisine type) — shown in the guest AI chat greeting and passed to the AI as context. Empty by default; never auto-filled.';
