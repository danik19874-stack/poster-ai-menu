"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "../CartContext";
import styles from "./cart.module.css";

export default function CartPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const cart = useCart();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [orderId, setOrderId] = useState<number | null>(null);

  // params is a Promise in this Next.js version even in client components;
  // resolve it in an Effect rather than making the whole component async
  // (client components can't be async functions).
  useEffect(() => {
    params.then((p) => setRestaurantId(p.restaurantId));
  }, [params]);

  const menuHref = restaurantId
    ? `/menu-preview/${restaurantId}${cart.table ? `?table=${cart.table}` : ""}`
    : "#";

  if (status === "done" && orderId !== null) {
    return (
      <div className={styles.page}>
        <div className={styles.confirmation}>
          <p className={styles.confirmationTitle}>Заказ №{orderId} отправлен</p>
          <p className={styles.confirmationText}>
            Официант уже видит его на кассе и подтвердит за несколько секунд — дальше блюда
            уходят на кухню. Ждать у стола не нужно.
          </p>
          <Link href={menuHref} className={styles.backLink}>
            ← Вернуться в меню
          </Link>
        </div>
      </div>
    );
  }

  if (!cart.table) {
    return (
      <div className={styles.page}>
        <p className={styles.warning}>
          Номер стола не определён — отсканируйте QR-код на столе ещё раз, иначе заказ отправить
          не получится.
        </p>
        <Link href={menuHref} className={styles.backLink}>
          ← В меню
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Корзина пуста — выберите блюда в меню.</p>
        <Link href={menuHref} className={styles.backLink}>
          ← В меню
        </Link>
      </div>
    );
  }

  async function submit() {
    if (!restaurantId) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          tableLabel: cart.table,
          items: cart.items.map((item) => ({ productId: item.productId, count: item.qty })),
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { posterIncomingOrderId: number };
      setOrderId(data.posterIncomingOrderId);
      cart.clear();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={styles.page}>
      <Link href={menuHref} className={styles.backLink}>
        ← В меню
      </Link>
      <h1 className={styles.title}>Ваш заказ</h1>

      <ul className={styles.list}>
        {cart.items.map((item) => (
          <li key={item.productId} className={styles.row}>
            <div>
              <p className={styles.name}>{item.name}</p>
              <p className={styles.price}>{item.price} ₸</p>
            </div>
            <div className={styles.qtyControl}>
              <button type="button" onClick={() => cart.updateQty(item.productId, item.qty - 1)}>
                −
              </button>
              <span>{item.qty}</span>
              <button type="button" onClick={() => cart.updateQty(item.productId, item.qty + 1)}>
                +
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.totalRow}>
        <span>Итого</span>
        <span>{cart.total} ₸</span>
      </div>

      {status === "error" && (
        <p className={styles.warning}>Не получилось отправить заказ. Попробуйте ещё раз.</p>
      )}

      <button
        type="button"
        className={styles.submitButton}
        disabled={status === "submitting"}
        onClick={submit}
      >
        {status === "submitting" ? "Отправляем…" : "Оформить заказ"}
      </button>
    </div>
  );
}
