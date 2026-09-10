"use client";

import { useState } from "react";
import { useCart } from "../CartContext";
import styles from "./detail.module.css";

export default function AddToCart({
  table,
  productId,
  menuItemId,
  name,
  price,
}: {
  table?: string;
  productId: number;
  menuItemId: string;
  name: string;
  price: number;
}) {
  const cart = useCart();
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    cart.add({ productId, menuItemId, name, price, qty: 1 });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  if (!table) {
    return (
      <p className={styles.unknownNotice}>
        Номер стола не определён — отсканируйте QR-код на столе ещё раз.
      </p>
    );
  }

  return (
    <button type="button" className={styles.addButton} onClick={handleAdd}>
      {justAdded ? "Добавлено ✓" : "Добавить в заказ"}
    </button>
  );
}
