import { describe, it, expect } from 'vitest';
import { validateOrderItems } from './validateOrderItems';

describe('validateOrderItems', () => {
  it('accepts a well-formed item list', () => {
    const result = validateOrderItems([{ productId: 1, count: 2 }]);
    expect(result).toEqual([{ productId: 1, count: 2 }]);
  });

  it('carries an optional modificatorId through', () => {
    const result = validateOrderItems([{ productId: 1, count: 1, modificatorId: 5 }]);
    expect(result).toEqual([{ productId: 1, count: 1, modificatorId: 5 }]);
  });

  it('rejects a missing productId', () => {
    expect(() => validateOrderItems([{ count: 1 }])).toThrow();
  });

  it('rejects a non-integer productId', () => {
    expect(() => validateOrderItems([{ productId: 'abc', count: 1 }])).toThrow();
  });

  it('rejects a zero or negative count', () => {
    expect(() => validateOrderItems([{ productId: 1, count: 0 }])).toThrow();
    expect(() => validateOrderItems([{ productId: 1, count: -3 }])).toThrow();
  });

  it('rejects a non-integer count', () => {
    expect(() => validateOrderItems([{ productId: 1, count: 1.5 }])).toThrow();
  });

  it('rejects a count above the sanity cap', () => {
    expect(() => validateOrderItems([{ productId: 1, count: 51 }])).toThrow();
  });

  it('accepts a count at the sanity cap', () => {
    expect(() => validateOrderItems([{ productId: 1, count: 50 }])).not.toThrow();
  });

  it('rejects more distinct line items than the sanity cap', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ productId: i + 1, count: 1 }));
    expect(() => validateOrderItems(items)).toThrow();
  });

  it('accepts exactly the line-item cap', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ productId: i + 1, count: 1 }));
    expect(() => validateOrderItems(items)).not.toThrow();
  });

  it('rejects a non-object item', () => {
    expect(() => validateOrderItems(['not-an-object'])).toThrow();
  });
});
