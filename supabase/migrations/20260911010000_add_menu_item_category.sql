-- Poster's menu.getProducts returns a category_name per product (verified
-- live 11.09.2026: e.g. "Кофе", "Холодные напитки"). Needed to group the
-- guest-facing menu by category instead of one flat list.
alter table menu_items
  add column category_name text;
