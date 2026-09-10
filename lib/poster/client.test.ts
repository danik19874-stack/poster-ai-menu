import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOrder, getProducts } from './client';
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

  it('wraps a network failure (fetch rejecting) in a PosterApiError with status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND joinposter.com')),
    );

    const promise = createOrder('test-token', {
      spotId: 42,
      tableId: 17,
      serviceMode: 1,
      autoAccept: true,
      products: [{ productId: 169, count: 1 }],
    });

    await expect(promise).rejects.toThrow(PosterApiError);
    await expect(promise).rejects.toMatchObject({ statusCode: 0 });
  });

  it('throws PosterApiError when a successful response has an unexpected shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ response: { status: 1 } }),
      }),
    );

    await expect(
      createOrder('test-token', {
        spotId: 42,
        tableId: 17,
        serviceMode: 1,
        autoAccept: true,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toThrow(PosterApiError);
  });
});

describe('getProducts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps Poster product + ingredient fields into our PosterProduct shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            {
              product_id: '169',
              product_name: 'Стейк рибай',
              description: 'Сочный стейк',
              price: { '1': '420000' },
              ingredient_name: ['говядина', 'розмарин'],
              hidden: '0',
            },
            {
              product_id: '170',
              product_name: 'Салат без описания состава',
              description: '',
              price: { '1': '150000' },
              ingredient_name: null,
              hidden: '0',
            },
          ],
        }),
      }),
    );

    const products = await getProducts('test-token');

    expect(products).toHaveLength(2);
    expect(products[0]).toEqual({
      productId: 169,
      name: 'Стейк рибай',
      description: 'Сочный стейк',
      price: 4200,
      ingredients: [{ name: 'говядина' }, { name: 'розмарин' }],
      inStopList: false,
    });
    expect(products[1].ingredients).toBeNull();
  });
});
