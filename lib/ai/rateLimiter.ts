// Per-restaurant sliding-window guard on the AI chat endpoints. The shared
// Gemini fallback chain has a hard daily budget across ALL restaurants
// (currently ~1020 requests/day total, see lib/gemini/models.ts) — without
// this, a single abusive or scripted guest could burn through that whole
// budget in minutes and deny the AI feature to every other restaurant.
export const MAX_AI_REQUESTS_PER_WINDOW = 20;
export const WINDOW_MS = 5 * 60 * 1000;

export interface RateLimiterDeps {
  countRecentActivity: (restaurantId: string, sinceIso: string) => Promise<number>;
}

export async function isRateLimited(
  deps: RateLimiterDeps,
  restaurantId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const count = await deps.countRecentActivity(restaurantId, since);
  return count >= MAX_AI_REQUESTS_PER_WINDOW;
}
