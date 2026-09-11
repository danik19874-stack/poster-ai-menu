export interface GeminiKey {
  id: string;
  apiKey: string;
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
): Promise<GeminiKey | null> {
  const keys = await deps.getActiveKeys();

  for (const key of keys) {
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
