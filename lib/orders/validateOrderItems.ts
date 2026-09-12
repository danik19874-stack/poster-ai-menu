import type { CreateIncomingOrderItem } from '../poster/types';

const MAX_LINE_ITEMS = 50;
const MAX_COUNT_PER_ITEM = 50;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Validates untrusted, client-supplied cart items at the API boundary before
 * they reach Poster's incomingOrders API. Poster has no client-supplied price
 * field to worry about, but an unbounded count or item list is still a real
 * abuse/prank vector (e.g. count: 999999) that a real waiter would have to
 * deal with — reject it here instead.
 */
export function validateOrderItems(raw: unknown[]): CreateIncomingOrderItem[] {
  if (raw.length > MAX_LINE_ITEMS) {
    throw new Error(`Order cannot contain more than ${MAX_LINE_ITEMS} distinct items`);
  }

  return raw.map((rawItem, index) => {
    if (typeof rawItem !== 'object' || rawItem === null) {
      throw new Error(`Item at index ${index} must be an object`);
    }

    const { productId, count, modificatorId } = rawItem as Record<string, unknown>;

    if (!isPositiveInteger(productId)) {
      throw new Error(`Item at index ${index}: productId must be a positive integer`);
    }
    if (!isPositiveInteger(count)) {
      throw new Error(`Item at index ${index}: count must be a positive integer`);
    }
    if (count > MAX_COUNT_PER_ITEM) {
      throw new Error(`Item at index ${index}: count cannot exceed ${MAX_COUNT_PER_ITEM}`);
    }
    if (modificatorId !== undefined && !isPositiveInteger(modificatorId)) {
      throw new Error(`Item at index ${index}: modificatorId must be a positive integer`);
    }

    const item: CreateIncomingOrderItem = { productId, count };
    if (modificatorId !== undefined) {
      item.modificatorId = modificatorId;
    }
    return item;
  });
}
