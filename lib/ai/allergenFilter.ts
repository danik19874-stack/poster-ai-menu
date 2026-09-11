import type { MenuItemSummary } from './menuRecommendation';

/**
 * Deterministic, code-owned safety net — NOT a substitute for the model's own
 * judgment, a backstop for it. Live testing showed the model does not reliably
 * generalize "пармезан" -> dairy even with an explicit prompt rule saying so
 * (12.09.2026: recommended a Caesar salad with parmesan for a stated milk
 * allergy, unprompted, twice). Items matching a named allergen category are
 * removed from what the model even sees, so it cannot recommend them no
 * matter how it reasons — the existing anti-hallucination check in
 * buildMenuRecommendation then also can't validate them, since they're gone
 * from the known-items list entirely.
 */
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  dairy: [
    'молоко',
    'молочн',
    'сыр',
    'пармезан',
    'сливк',
    'сливочн',
    'йогурт',
    'сметан',
    'творог',
    'моцарелл',
    'чеддер',
  ],
  gluten: ['глютен', 'пшениц', 'мука', 'мучн', 'хлеб', 'панировк', 'спагетти', 'макарон', 'тесто', 'булочк'],
  nuts: ['арахис', 'орех', 'миндал', 'фундук', 'кешью'],
};

const ALLERGY_TRIGGER_WORDS = ['аллерг', 'непереносим'];

export function detectAllergenCategories(question: string): string[] {
  const lower = question.toLowerCase();
  const mentionsAllergyIntent = ALLERGY_TRIGGER_WORDS.some((word) => lower.includes(word));
  if (!mentionsAllergyIntent) return [];

  return Object.entries(ALLERGEN_KEYWORDS)
    .filter(([, keywords]) => keywords.some((kw) => lower.includes(kw)))
    .map(([category]) => category);
}

function itemMatchesAllergenCategory(item: MenuItemSummary, category: string): boolean {
  // Unknown composition is treated as unsafe by default once a specific
  // allergy has been named — better to under-recommend than risk it.
  if (!item.ingredientsKnown) return true;

  const keywords = ALLERGEN_KEYWORDS[category] ?? [];
  return item.ingredients.some((ingredient) => {
    const lower = ingredient.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  });
}

export function filterOutAllergenMatches(
  items: MenuItemSummary[],
  question: string,
): MenuItemSummary[] {
  const categories = detectAllergenCategories(question);
  if (categories.length === 0) return items;

  return items.filter((item) => !categories.some((category) => itemMatchesAllergenCategory(item, category)));
}
