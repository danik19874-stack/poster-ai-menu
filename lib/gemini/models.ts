export interface GeminiModelTier {
  model: string;
  /** Real free-tier requests-per-day limit for this model, verified 12.09.2026
   *  against the account's own AI Studio rate-limit dashboard (Google no longer
   *  publishes exact free-tier numbers in its public docs — they're per-project). */
  dailyLimit: number;
  /** Lower tries first. Lite models have far more daily quota (500 vs ~20) and
   *  hold up fine on real quality tests for both the single-dish and whole-menu
   *  tasks, so they're exhausted before falling back to the smaller-quota model. */
  priority: number;
}

export const GEMINI_MODEL_CHAIN: GeminiModelTier[] = [
  { model: 'gemini-3.1-flash-lite', dailyLimit: 500, priority: 0 },
  { model: 'gemini-3.5-flash-lite', dailyLimit: 500, priority: 1 },
  { model: 'gemini-3.8-flash', dailyLimit: 20, priority: 2 },
];
