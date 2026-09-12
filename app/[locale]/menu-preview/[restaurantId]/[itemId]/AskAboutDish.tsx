"use client";

import { useState } from "react";
import { useCart } from "../CartContext";
import { buildGreeting } from "@/lib/ai/greeting";
import styles from "./detail.module.css";

interface Props {
  restaurantId: string;
  itemId: string;
  dishName: string;
  restaurantName: string;
  restaurantDescription: string;
}

export default function AskAboutDish({
  restaurantId,
  itemId,
  dishName,
  restaurantName,
  restaurantDescription,
}: Props) {
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
      const res = await fetch("/api/ask-dish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          itemId,
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
    <div className={styles.askSection}>
      {!answer && restaurantName && (
        <div className={styles.answer}>
          <p>{buildGreeting(restaurantName, restaurantDescription)}</p>
        </div>
      )}
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
      <form className={styles.askForm} onSubmit={handleSubmit}>
        <input
          className={styles.askInput}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Спросить про «${dishName}»`}
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
    </div>
  );
}
