"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CartItem } from "@/lib/cart/cartReducer";
import { addItem, cartTotal, removeItem, setQty } from "@/lib/cart/cartReducer";

interface CartContextValue {
  items: CartItem[];
  total: number;
  table: string | null;
  add: (item: CartItem) => void;
  updateQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(restaurantId: string, table: string) {
  return `cart:${restaurantId}:${table}`;
}

export function CartProvider({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: React.ReactNode;
}) {
  const table = useSearchParams().get("table");
  const [items, setItems] = useState<CartItem[]>([]);

  // Table can only be known once we're on the client (search params), so the
  // cart is empty on first server-rendered paint and hydrates from
  // localStorage right after — matches the rest of this page, which is
  // already fully client/browser-driven for anything cart-related.
  useEffect(() => {
    if (!table) return;
    try {
      const raw = localStorage.getItem(storageKey(restaurantId, table));
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
  }, [restaurantId, table]);

  function persist(next: CartItem[]) {
    setItems(next);
    if (!table) return;
    try {
      localStorage.setItem(storageKey(restaurantId, table), JSON.stringify(next));
    } catch {
      // localStorage unavailable (private mode, quota) — cart still works for this page view
    }
  }

  const value: CartContextValue = {
    items,
    total: cartTotal(items),
    table,
    add: (item) => persist(addItem(items, item)),
    updateQty: (productId, qty) => persist(setQty(items, productId, qty)),
    remove: (productId) => persist(removeItem(items, productId)),
    clear: () => persist([]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
