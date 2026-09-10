import { describe, expect, it } from 'vitest';
import { addItem, cartTotal, removeItem, setQty } from './cartReducer';
import type { CartItem } from './cartReducer';

const croissant: CartItem = { productId: 1, menuItemId: 'a', name: 'Круассан', price: 1200, qty: 1 };
const latte: CartItem = { productId: 2, menuItemId: 'b', name: 'Латте', price: 1500, qty: 1 };

describe('addItem', () => {
  it('appends a new product with qty 1', () => {
    expect(addItem([], croissant)).toEqual([croissant]);
  });

  it('increments qty when the product is already in the cart', () => {
    const result = addItem([croissant], croissant);
    expect(result).toEqual([{ ...croissant, qty: 2 }]);
  });

  it('leaves other items untouched', () => {
    const result = addItem([croissant, latte], croissant);
    expect(result).toEqual([{ ...croissant, qty: 2 }, latte]);
  });
});

describe('setQty', () => {
  it('updates the qty of the matching product', () => {
    expect(setQty([croissant], 1, 3)).toEqual([{ ...croissant, qty: 3 }]);
  });

  it('removes the item when qty is set to 0', () => {
    expect(setQty([croissant, latte], 1, 0)).toEqual([latte]);
  });
});

describe('removeItem', () => {
  it('drops the matching product', () => {
    expect(removeItem([croissant, latte], 1)).toEqual([latte]);
  });

  it('is a no-op when the product is not in the cart', () => {
    expect(removeItem([latte], 999)).toEqual([latte]);
  });
});

describe('cartTotal', () => {
  it('sums price times qty across all items', () => {
    expect(cartTotal([croissant, { ...latte, qty: 2 }])).toBe(1200 * 1 + 1500 * 2);
  });

  it('is 0 for an empty cart', () => {
    expect(cartTotal([])).toBe(0);
  });
});
