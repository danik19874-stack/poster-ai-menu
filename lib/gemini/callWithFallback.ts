import { pickAvailableKey, recordKeyUsage, todayUtc } from './keyPool';
import type { GeminiKey } from './keyPool';

export class NoAvailableKeyError extends Error {}

interface Deps {
  /** Must already be filtered to is_active = true, ordered by priority (cheapest/most
   *  generous model first) — this module doesn't re-sort. */
  getActiveKeys: () => Promise<GeminiKey[]>;
  resetDailyUsage: (keyId: string) => Promise<void>;
  incrementUsage: (keyId: string, requestsToday: number) => Promise<void>;
  callModel: (key: GeminiKey, systemInstruction: string, userMessage: string) => Promise<unknown>;
}

/**
 * Tries each (key, model) candidate in priority order until one answers. A candidate
 * that throws (quota exhausted mid-flight, Google overloaded, network blip) still has
 * its usage recorded — Google counts the attempt against that model's quota whether it
 * succeeded or not — and is never retried; the next candidate is tried instead.
 */
export async function callGeminiWithFallback(
  deps: Deps,
  systemInstruction: string,
  userMessage: string,
  today: string = todayUtc(),
): Promise<unknown> {
  const tried = new Set<string>();
  let lastError: unknown;

  for (;;) {
    const key = await pickAvailableKey(
      { getActiveKeys: deps.getActiveKeys, resetDailyUsage: deps.resetDailyUsage },
      today,
      tried,
    );
    if (!key) break;
    tried.add(key.id);

    try {
      const answer = await deps.callModel(key, systemInstruction, userMessage);
      await recordKeyUsage({ incrementUsage: deps.incrementUsage }, key);
      return answer;
    } catch (err) {
      await recordKeyUsage({ incrementUsage: deps.incrementUsage }, key);
      lastError = err;
    }
  }

  if (tried.size === 0) {
    throw new NoAvailableKeyError('No Gemini key/model candidates available today');
  }
  throw lastError;
}
