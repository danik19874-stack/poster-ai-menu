export interface GeminiKey {
  id: string;
  apiKey: string;
  /** Real Gemini model id this row's quota tracks, e.g. "gemini-3.1-flash-lite" — each
   *  model has its own independent daily quota on Google's side, even for the same
   *  underlying API key, so one real key becomes several rows, one per model. */
  model: string;
  dailyLimit: number;
  requestsToday: number;
  /** ISO date string, e.g. "2026-09-11" — the day requestsToday counts against. */
  usageDate: string;
}

interface PickDeps {
  /** Must already be filtered to is_active = true — this function doesn't re-check activeness. */
  getActiveKeys: () => Promise<GeminiKey[]>;
  resetDailyUsage: (keyId: string) => Promise<void>;
}

interface RecordDeps {
  incrementUsage: (keyId: string, requestsToday: number) => Promise<void>;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function pickAvailableKey(
  deps: PickDeps,
  today: string = todayUtc(),
  excludeIds: ReadonlySet<string> = new Set(),
): Promise<GeminiKey | null> {
  const keys = await deps.getActiveKeys();

  for (const key of keys) {
    if (excludeIds.has(key.id)) continue;

    let requestsToday = key.requestsToday;
    let usageDate = key.usageDate;

    if (usageDate !== today) {
      await deps.resetDailyUsage(key.id);
      requestsToday = 0;
      usageDate = today;
    }

    if (requestsToday < key.dailyLimit) {
      return { ...key, requestsToday, usageDate };
    }
  }

  return null;
}

export async function recordKeyUsage(deps: RecordDeps, key: GeminiKey): Promise<void> {
  await deps.incrementUsage(key.id, key.requestsToday + 1);
}
