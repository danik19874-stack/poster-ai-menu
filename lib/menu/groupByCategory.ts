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
