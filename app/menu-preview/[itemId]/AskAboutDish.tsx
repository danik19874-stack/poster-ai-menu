"use client";

import { useState } from "react";
import styles from "./detail.module.css";

interface Props {
  dishName: string;
  ingredientsKnown: boolean;
  ingredientNames: string[];
}

/**
 * Deterministic stand-in for the real AI chat (Plan 2, not built yet). No
 * LLM call — just enforces the one non-negotiable rule up front: never
 * claim ingredients we don't actually have, always defer to staff when
 * data is missing. Lets us test the safety contract on real synced data
 * before the real AI layer exists.
 */
export default function AskAboutDish({ dishName, ingredientsKnown, ingredientNames }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    if (!ingredientsKnown) {
      setAnswer(
        `Пока нет точных данных о составе блюда «${dishName}» — не хочу гадать и рисковать с аллергенами. Уточните у официанта, он подтвердит на кассе.`,
      );
      return;
    }

    setAnswer(
      `В составе «${dishName}»: ${ingredientNames.join(", ")}. Данные об аллергенах отдельно не отмечены — если для вас критично, всё равно уточните у официанта.`,
    );
  }

  return (
    <div className={styles.askSection}>
      {answer && (
        <div className={styles.answer}>
          <p className={styles.answerLabel}>Ответ</p>
          <p>{answer}</p>
        </div>
      )}
      <form className={styles.askForm} onSubmit={handleSubmit}>
        <input
          className={styles.askInput}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Спросить про состав или аллергены"
        />
        <button className={styles.askButton} type="submit" disabled={!question.trim()}>
          Спросить
        </button>
      </form>
    </div>
  );
}
