import { describe, expect, it } from 'vitest';
import { detectAllergenCategories, filterOutAllergenMatches } from './allergenFilter';
import type { MenuItemSummary } from './menuRecommendation';

function item(overrides: Partial<MenuItemSummary>): MenuItemSummary {
  return {
    name: 'Блюдо',
    price: 1000,
    categoryName: null,
    ingredientsKnown: true,
    ingredients: [],
    ...overrides,
  };
}

describe('detectAllergenCategories', () => {
  it('detects the dairy category from a Russian dairy-allergy question', () => {
    expect(detectAllergenCategories('У меня аллергия на молоко, что можно взять?')).toEqual(['dairy']);
  });

  it('detects the gluten category', () => {
    expect(detectAllergenCategories('У меня непереносимость глютена')).toEqual(['gluten']);
  });

  it('detects multiple categories at once', () => {
    const categories = detectAllergenCategories('Аллергия на молоко и орехи');
    expect(categories.sort()).toEqual(['dairy', 'nuts']);
  });

  it('returns an empty list when the question does not mention an allergy at all', () => {
    expect(detectAllergenCategories('Посоветуйте что-нибудь на компанию из 3 человек')).toEqual([]);
  });

  it('returns an empty list when an allergy word is used without naming a known category', () => {
    expect(detectAllergenCategories('У меня аллергия, но не скажу на что')).toEqual([]);
  });
});

describe('filterOutAllergenMatches', () => {
  const CAPPUCCINO = item({ name: 'Капучино', ingredients: ['вода', 'кофе', 'молоко'] });
  const CAESAR = item({ name: 'Салат Цезарь', ingredients: ['курица', 'салат', 'пармезан', 'соус'] });
  const PLOV = item({ name: 'Плов', ingredients: ['рис', 'баранина', 'морковь'] });
  const UNKNOWN_BURGER = item({ name: 'Бургер', ingredientsKnown: false, ingredients: [] });

  it('excludes items whose ingredients match the mentioned allergen category, even by category not literal name', () => {
    const items = [CAPPUCCINO, CAESAR, PLOV];

    const result = filterOutAllergenMatches(items, 'У меня аллергия на молоко, что можно взять?');

    // Cappuccino (literal "молоко") AND Caesar (parmesan -> dairy category) both excluded.
    expect(result.map((i) => i.name)).toEqual(['Плов']);
  });

  it('excludes items with unknown composition when a specific allergy was named — unsafe by default', () => {
    const items = [PLOV, UNKNOWN_BURGER];

    const result = filterOutAllergenMatches(items, 'Аллергия на орехи');

    expect(result.map((i) => i.name)).toEqual(['Плов']);
  });

  it('does not filter anything when the question does not mention an allergy', () => {
    const items = [CAPPUCCINO, CAESAR, PLOV, UNKNOWN_BURGER];

    const result = filterOutAllergenMatches(items, 'Посоветуйте на компанию из 3 человек');

    expect(result).toEqual(items);
  });

  it('can filter out every item when nothing is safe', () => {
    const items = [CAPPUCCINO, CAESAR];

    const result = filterOutAllergenMatches(items, 'Аллергия на молоко');

    expect(result).toEqual([]);
  });
});
