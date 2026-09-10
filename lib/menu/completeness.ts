interface MenuItemForCompleteness {
  name: string;
  ingredients_known: boolean;
}

export interface CompletenessResult {
  total: number;
  withIngredients: number;
  missingDishNames: string[];
}

export function getIngredientCompleteness(
  items: MenuItemForCompleteness[],
): CompletenessResult {
  return {
    total: items.length,
    withIngredients: items.filter((item) => item.ingredients_known).length,
    missingDishNames: items
      .filter((item) => !item.ingredients_known)
      .map((item) => item.name),
  };
}
