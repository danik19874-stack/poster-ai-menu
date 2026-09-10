export interface CartItem {
  productId: number;
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
}

export function addItem(cart: CartItem[], item: CartItem): CartItem[] {
  const existing = cart.find((entry) => entry.productId === item.productId);
  if (!existing) {
    return [...cart, item];
  }
  return cart.map((entry) =>
    entry.productId === item.productId ? { ...entry, qty: entry.qty + item.qty } : entry,
  );
}

export function setQty(cart: CartItem[], productId: number, qty: number): CartItem[] {
  if (qty <= 0) {
    return removeItem(cart, productId);
  }
  return cart.map((entry) => (entry.productId === productId ? { ...entry, qty } : entry));
}

export function removeItem(cart: CartItem[], productId: number): CartItem[] {
  return cart.filter((entry) => entry.productId !== productId);
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, entry) => sum + entry.price * entry.qty, 0);
}
