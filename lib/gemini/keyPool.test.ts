import { describe, expect, it, vi } from 'vitest';
import { pickAvailableKey, recordKeyUsage } from './keyPool';
import type { GeminiKey } from './keyPool';

const TODAY = '2026-09-11';

function makeKey(overrides: Partial<GeminiKey> = {}): GeminiKey {
  return {
    id: 'key-1',
    apiKey: 'secret-1',
    dailyLimit: 1500,
    requestsToday: 0,
    usageDate: TODAY,
    ...overrides,
  };
}

describe('pickAvailableKey', () => {
  it('returns the first active key that still has budget today', async () => {
    const keys = [makeKey({ id: 'a', requestsToday: 10 }), makeKey({ id: 'b' })];
    const deps = { getActiveKeys: vi.fn().mockResolvedValue(keys), resetDailyUsage: vi.fn() };

    const picked = await pickAvailableKey(deps, TODAY);

    expect(picked?.id).toBe('a');
  });

  it('skips an exhausted key and returns the next one with budget', async () => {
    const keys = [
      makeKey({ id: 'a', requestsToday: 1500, dailyLimit: 1500 }),
      makeKey({ id: 'b', requestsToday: 3, dailyLimit: 1500 }),
    ];
    const deps = { getActiveKeys: vi.fn().mockResolvedValue(keys), resetDailyUsage: vi.fn() };

    const picked = await pickAvailableKey(deps, TODAY);

    expect(picked?.id).toBe('b');
  });

  it('returns null when every key is exhausted', async () => {
    const keys = [makeKey({ id: 'a', requestsToday: 1500, dailyLimit: 1500 })];
    const deps = { getActiveKeys: vi.fn().mockResolvedValue(keys), resetDailyUsage: vi.fn() };

    const picked = await pickAvailableKey(deps, TODAY);

    expect(picked).toBeNull();
  });

  it('treats a key from a previous day as reset to 0 and calls resetDailyUsage', async () => {
    const keys = [makeKey({ id: 'a', requestsToday: 1500, dailyLimit: 1500, usageDate: '2026-09-10' })];
    const resetDailyUsage = vi.fn().mockResolvedValue(undefined);
    const deps = { getActiveKeys: vi.fn().mockResolvedValue(keys), resetDailyUsage };

    const picked = await pickAvailableKey(deps, TODAY);

    expect(picked).toEqual({ id: 'a', apiKey: 'secret-1', dailyLimit: 1500, requestsToday: 0, usageDate: TODAY });
    expect(resetDailyUsage).toHaveBeenCalledWith('a');
  });

  it('returns null when there are no active keys at all', async () => {
    const deps = { getActiveKeys: vi.fn().mockResolvedValue([]), resetDailyUsage: vi.fn() };

    expect(await pickAvailableKey(deps, TODAY)).toBeNull();
  });
});

describe('recordKeyUsage', () => {
  it('increments requestsToday by 1 relative to the given key state', async () => {
    const incrementUsage = vi.fn().mockResolvedValue(undefined);

    await recordKeyUsage({ incrementUsage }, makeKey({ id: 'a', requestsToday: 4 }));

    expect(incrementUsage).toHaveBeenCalledWith('a', 5);
  });
});
