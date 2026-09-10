"use client";

import Link from "next/link";
import { useCart } from "./CartContext";
import styles from "./menu.module.css";

export default function CartBar({
  restaurantId,
  table,
}: {
  restaurantId: string;
  table?: string;
}) {
  const cart = useCart();

  if (cart.items.length === 0) return null;

  const count = cart.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className={styles.askBar}>
      <Link
        href={`/menu-preview/${restaurantId}/cart${table ? `?table=${table}` : ""}`}
        className={styles.askPill}
      >
        <span>
          {count} {count === 1 ? "блюдо" : "блюда"} · {cart.total} ₸
        </span>
        <span>Просмотреть заказ →</span>
      </Link>
    </div>
  );
}
