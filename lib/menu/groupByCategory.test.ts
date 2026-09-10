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
