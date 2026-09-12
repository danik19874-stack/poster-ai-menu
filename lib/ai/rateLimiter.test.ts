import { describe, it, expect, vi } from 'vitest';
import { isRateLimited, MAX_AI_REQUESTS_PER_WINDOW, WINDOW_MS } from './rateLimiter';

describe('isRateLimited', () => {
  it('allows the request when recent activity is below the limit', async () => {
    const countRecentActivity = vi.fn().mockResolvedValue(MAX_AI_REQUESTS_PER_WINDOW - 1);
    const limited = await isRateLimited({ countRecentActivity }, 'restaurant-1');
    expect(limited).toBe(false);
  });

  it('blocks the request once the limit is reached', async () => {
    const countRecentActivity = vi.fn().mockResolvedValue(MAX_AI_REQUESTS_PER_WINDOW);
    const limited = await isRateLimited({ countRecentActivity }, 'restaurant-1');
    expect(limited).toBe(true);
  });

  it('blocks the request when recent activity exceeds the limit', async () => {
    const countRecentActivity = vi.fn().mockResolvedValue(MAX_AI_REQUESTS_PER_WINDOW + 5);
    const limited = await isRateLimited({ countRecentActivity }, 'restaurant-1');
    expect(limited).toBe(true);
  });

  it('checks activity only within the sliding window, scoped to the given restaurant', async () => {
    const countRecentActivity = vi.fn().mockResolvedValue(0);
    const now = new Date('2026-09-12T12:00:00.000Z');
    await isRateLimited({ countRecentActivity }, 'restaurant-42', now);

    expect(countRecentActivity).toHaveBeenCalledWith(
      'restaurant-42',
      new Date(now.getTime() - WINDOW_MS).toISOString(),
    );
  });
});
