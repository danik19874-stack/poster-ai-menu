import { describe, it, expect } from 'vitest';
import { getIngredientCompleteness } from './completeness';

describe('getIngredientCompleteness', () => {
  it('counts how many menu items have known ingredients and names the ones that do not', () => {
    const items = [
      { name: 'Стейк рибай', ingredients_known: true },
      { name: 'Салат без состава', ingredients_known: false },
      { name: 'Плов', ingredients_known: true },
    ];

    const result = getIngredientCompleteness(items);

    expect(result).toEqual({
      total: 3,
      withIngredients: 2,
      missingDishNames: ['Салат без состава'],
    });
  });

  it('handles an empty menu without dividing by zero', () => {
    expect(getIngredientCompleteness([])).toEqual({
      total: 0,
      withIngredients: 0,
      missingDishNames: [],
    });
  });
});
