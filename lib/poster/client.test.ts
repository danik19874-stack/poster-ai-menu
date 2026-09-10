import { describe, it, expect, vi, afterEach } from 'vitest';
import { createIncomingOrder, getProducts } from './client';
import { PosterApiError } from './types';

describe('createIncomingOrder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends spot_id, phone, skip_phone_validation, service_mode, comment, and products in snake_case, and maps the response back to camelCase', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: { incoming_order_id: 106, status: 0, spot_id: 42 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createIncomingOrder('test-token', {
      spotId: 42,
      phone: '+70000000000',
      skipPhoneValidation: true,
      serviceMode: 1,
      comment: 'Стол 7',
      products: [{ productId: 169, count: 2 }],
    });

    expect(result).toEqual({ incomingOrderId: 106, status: 0 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://joinposter.com/api/incomingOrders.createIncomingOrder?token=test-token',
    );
    const body = JSON.parse(options.body as string);
    expect(body.spot_id).toBe(42);
    expect(body.phone).toBe('+70000000000');
    expect(body.skip_phone_validation).toBe(true);
    expect(body.service_mode).toBe(1);
    expect(body.comment).toBe('Стол 7');
    expect(body.products).toEqual([{ product_id: 169, count: 2 }]);
  });

  it('omits comment and skip_phone_validation from the wire body when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: { incoming_order_id: 106, status: 0 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await createIncomingOrder('test-token', {
      spotId: 42,
      phone: '+70000000000',
      serviceMode: 1,
      products: [{ productId: 169, count: 1 }],
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body).not.toHaveProperty('comment');
    expect(body).not.toHaveProperty('skip_phone_validation');
    expect(body.products[0]).not.toHaveProperty('modificator_id');
  });

  it('coerces a stringly-typed incoming_order_id/status (older Poster endpoints return numbers as strings)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: { incoming_order_id: '106', status: '0' },
        }),
      }),
    );

    const result = await createIncomingOrder('test-token', {
      spotId: 42,
      phone: '+7',
      serviceMode: 1,
      products: [{ productId: 169, count: 1 }],
    });

    expect(result).toEqual({ incomingOrderId: 106, status: 0 });
  });

  it('throws PosterApiError when Poster returns a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid phone' } }),
      }),
    );

    await expect(
      createIncomingOrder('test-token', {
        spotId: 42,
        phone: '',
        serviceMode: 1,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toThrow(PosterApiError);
  });

  it('throws PosterApiError instead of returning a garbage result when the response is missing incoming_order_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: { status: 0 } }),
      }),
    );

    await expect(
      createIncomingOrder('test-token', {
        spotId: 42,
        phone: '+7',
        serviceMode: 1,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toThrow(PosterApiError);
  });

  it('wraps a network failure (fetch rejecting) in PosterApiError with statusCode 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(
      createIncomingOrder('test-token', {
        spotId: 42,
        phone: '+7',
        serviceMode: 1,
        products: [{ productId: 169, count: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 0 });
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

  it('throws PosterApiError instead of producing a NaN price when a product has no price at any spot', async () => {
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
              price: {},
              ingredient_name: ['говядина'],
              hidden: '0',
            },
          ],
        }),
      }),
    );

    await expect(getProducts('test-token')).rejects.toThrow(PosterApiError);
  });
});
