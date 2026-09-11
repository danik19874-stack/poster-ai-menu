import { describe, expect, it, vi } from 'vitest';
import { callGeminiWithFallback, NoAvailableKeyError } from './callWithFallback';
import type { GeminiKey } from './keyPool';

const TODAY = '2026-09-12';

function makeKey(overrides: Partial<GeminiKey> = {}): GeminiKey {
  return {
    id: 'key-1',
    apiKey: 'secret-1',
    model: 'gemini-3.1-flash-lite',
    dailyLimit: 500,
    requestsToday: 0,
    usageDate: TODAY,
    ...overrides,
  };
}

describe('callGeminiWithFallback', () => {
  it('calls the first available candidate and returns its answer without trying any other', async () => {
    const keys = [makeKey({ id: 'a' }), makeKey({ id: 'b' })];
    const callModel = vi.fn().mockResolvedValue({ answer: 'ok' });
    const incrementUsage = vi.fn().mockResolvedValue(undefined);

    const result = await callGeminiWithFallback(
      {
        getActiveKeys: () => Promise.resolve(keys),
        resetDailyUsage: vi.fn(),
        incrementUsage,
        callModel,
      },
      'sys',
      'question',
      TODAY,
    );

    expect(result).toEqual({ answer: 'ok' });
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(callModel).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'sys', 'question');
    expect(incrementUsage).toHaveBeenCalledWith('a', 1);
  });

  it('falls back to the next candidate when the first one throws, and still records usage for the failed attempt', async () => {
    const keys = [makeKey({ id: 'a' }), makeKey({ id: 'b' })];
    const callModel = vi
      .fn()
      .mockRejectedValueOnce(new Error('503 overloaded'))
      .mockResolvedValueOnce({ answer: 'from b' });
    const incrementUsage = vi.fn().mockResolvedValue(undefined);

    const result = await callGeminiWithFallback(
      {
        getActiveKeys: () => Promise.resolve(keys),
        resetDailyUsage: vi.fn(),
        incrementUsage,
        callModel,
      },
      'sys',
      'question',
      TODAY,
    );

    expect(result).toEqual({ answer: 'from b' });
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(incrementUsage).toHaveBeenCalledWith('a', 1);
    expect(incrementUsage).toHaveBeenCalledWith('b', 1);
  });

  it('never retries the same candidate twice', async () => {
    const keys = [makeKey({ id: 'a' }), makeKey({ id: 'b' })];
    const callModel = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      callGeminiWithFallback(
        {
          getActiveKeys: () => Promise.resolve(keys),
          resetDailyUsage: vi.fn(),
          incrementUsage: vi.fn().mockResolvedValue(undefined),
          callModel,
        },
        'sys',
        'question',
        TODAY,
      ),
    ).rejects.toThrow('always fails');

    expect(callModel).toHaveBeenCalledTimes(2);
    const calledIds = callModel.mock.calls.map((call) => (call[0] as GeminiKey).id);
    expect(new Set(calledIds).size).toBe(2);
  });

  it('throws the last real error once every candidate has failed', async () => {
    const keys = [makeKey({ id: 'a' })];
    const lastError = new Error('final failure');
    const callModel = vi.fn().mockRejectedValue(lastError);

    await expect(
      callGeminiWithFallback(
        {
          getActiveKeys: () => Promise.resolve(keys),
          resetDailyUsage: vi.fn(),
          incrementUsage: vi.fn().mockResolvedValue(undefined),
          callModel,
        },
        'sys',
        'question',
        TODAY,
      ),
    ).rejects.toBe(lastError);
  });

  it('throws NoAvailableKeyError when there are no candidates at all (none configured, or all over their daily limit)', async () => {
    const callModel = vi.fn();

    await expect(
      callGeminiWithFallback(
        {
          getActiveKeys: () => Promise.resolve([]),
          resetDailyUsage: vi.fn(),
          incrementUsage: vi.fn(),
          callModel,
        },
        'sys',
        'question',
        TODAY,
      ),
    ).rejects.toBeInstanceOf(NoAvailableKeyError);
    expect(callModel).not.toHaveBeenCalled();
  });
});
