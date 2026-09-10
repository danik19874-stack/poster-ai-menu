-- Poster's menu.getProducts returns a real photo URL per product (host-relative,
-- normalized to absolute in lib/poster/client.ts). Not part of the original
-- schema because Task 4 didn't map it — added once the guest UI needed real
-- dish photos instead of placeholders.
alter table menu_items
  add column photo_url text;
