import { describe, it, expect, vi } from 'vitest';
import { completeOAuthConnection } from './completeOAuthConnection';

describe('completeOAuthConnection', () => {
  it('exchanges the code, fetches spots, and upserts the restaurant using the first spot', async () => {
    const exchangeOAuthCode = vi
      .fn()
      .mockResolvedValue({ accessToken: '687409:abc123', accountNumber: '687409' });
    const getSpots = vi.fn().mockResolvedValue([
      { spotId: 1, name: 'Кафе на Полянке', address: 'Киев' },
      { spotId: 2, name: 'Вторая точка', address: 'Алматы' },
    ]);
    const upsertRestaurant = vi.fn().mockResolvedValue(undefined);

    const result = await completeOAuthConnection(
      { exchangeOAuthCode, getSpots, upsertRestaurant },
      { account: 'mycafe', code: 'the-code' },
    );

    expect(exchangeOAuthCode).toHaveBeenCalledWith('mycafe', 'the-code');
    expect(getSpots).toHaveBeenCalledWith('687409:abc123');
    expect(upsertRestaurant).toHaveBeenCalledWith({
      posterAccountNumber: '687409',
      posterSpotId: 1,
      posterToken: '687409:abc123',
      name: 'Кафе на Полянке',
    });
    expect(result).toEqual({ restaurantName: 'Кафе на Полянке' });
  });

  it('throws without upserting when the account has no spots', async () => {
    const exchangeOAuthCode = vi
      .fn()
      .mockResolvedValue({ accessToken: 'tok', accountNumber: '687409' });
    const getSpots = vi.fn().mockResolvedValue([]);
    const upsertRestaurant = vi.fn();

    await expect(
      completeOAuthConnection(
        { exchangeOAuthCode, getSpots, upsertRestaurant },
        { account: 'mycafe', code: 'the-code' },
      ),
    ).rejects.toThrow('no spots');
    expect(upsertRestaurant).not.toHaveBeenCalled();
  });

  it('propagates an exchangeOAuthCode failure without calling getSpots or upsertRestaurant', async () => {
    const exchangeError = new Error('bad code');
    const exchangeOAuthCode = vi.fn().mockRejectedValue(exchangeError);
    const getSpots = vi.fn();
    const upsertRestaurant = vi.fn();

    await expect(
      completeOAuthConnection(
        { exchangeOAuthCode, getSpots, upsertRestaurant },
        { account: 'mycafe', code: 'bad-code' },
      ),
    ).rejects.toThrow(exchangeError);
    expect(getSpots).not.toHaveBeenCalled();
    expect(upsertRestaurant).not.toHaveBeenCalled();
  });

  it('propagates a getSpots failure without calling upsertRestaurant', async () => {
    const exchangeOAuthCode = vi
      .fn()
      .mockResolvedValue({ accessToken: 'tok', accountNumber: '687409' });
    const spotsError = new Error('spots lookup failed');
    const getSpots = vi.fn().mockRejectedValue(spotsError);
    const upsertRestaurant = vi.fn();

    await expect(
      completeOAuthConnection(
        { exchangeOAuthCode, getSpots, upsertRestaurant },
        { account: 'mycafe', code: 'the-code' },
      ),
    ).rejects.toThrow(spotsError);
    expect(upsertRestaurant).not.toHaveBeenCalled();
  });
});
