import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOrder } from './client';
import { PosterApiError } from './types';

describe('createOrder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends tableId and autoAccept:true so the order lands on the kitchen without staff confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: { id: 156, status: 1, spotId: 42, tableId: 17 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createOrder('test-token', {
      spotId: 42,
      tableId: 17,
      serviceMode: 1,
      autoAccept: true,
      products: [{ productId: 169, count: 2 }],
    });

    expect(result.response.id).toBe(156);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://joinposter.com/api/orders?token=test-token');
    const body = JSON.parse(options.body as string);
    expect(body.tableId).toBe(17);
    expect(body.autoAccept).toBe(true);
    expect(body.serviceMode).toBe(1);
  });

  it('throws PosterApiError when Poster returns a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Table not found' } }),
      }),
    );

    await expect(
      createOrder('test-token', {
        spotId: 42,
        tableId: 999,
        serviceMode: 1,
        autoAccept: true,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toThrow(PosterApiError);
  });
});
