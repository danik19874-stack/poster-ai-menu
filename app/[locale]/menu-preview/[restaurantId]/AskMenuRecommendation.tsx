"use client";

import { useState } from "react";
import { useCart } from "./CartContext";
import styles from "./menu.module.css";

export default function AskMenuRecommendation({ restaurantId }: { restaurantId: string }) {
  const cart = useCart();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || status === "loading") return;

    setStatus("loading");
    setAnswer(null);

    try {
      const res = await fetch("/api/recommend-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          question,
          cart: cart.items.map((item) => ({ name: item.name, qty: item.qty })),
        }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data = (await res.json()) as { answer: string };
      setAnswer(data.answer);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={styles.recommendSection}>
      <p className={styles.recommendTitle}>Не знаете, что выбрать?</p>
      <form className={styles.askForm} onSubmit={handleSubmit}>
        <input
          className={styles.askInput}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Например: посоветуйте на компанию из 3 человек"
          disabled={status === "loading"}
        />
        <button
          className={styles.askButton}
          type="submit"
          disabled={!question.trim() || status === "loading"}
        >
          {status === "loading" ? "…" : "Спросить"}
        </button>
      </form>
      {answer && (
        <div className={styles.answer}>
          <p className={styles.answerLabel}>Ответ</p>
          <p>{answer}</p>
        </div>
      )}
      {status === "error" && (
        <p className={styles.unknownNotice}>
          Не получилось получить ответ — попробуйте ещё раз или спросите у официанта.
        </p>
      )}
    </div>
  );
}
