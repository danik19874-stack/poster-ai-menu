"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { buildMenuLink } from "@/lib/links/buildMenuLink";
import styles from "./connected.module.css";

export default function ConnectedClient({
  origin,
  restaurantId,
  restaurantName,
  initialDescription,
}: {
  origin: string;
  restaurantId: string;
  restaurantName: string;
  initialDescription: string;
}) {
  const t = useTranslations("Connected");
  const [table, setTable] = useState(1);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [description, setDescription] = useState(initialDescription);
  const [descriptionStatus, setDescriptionStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const link = origin && restaurantId ? buildMenuLink(origin, restaurantId, table) : "";

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 480, margin: 1 }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  function handleTableChange(value: string) {
    const parsed = Math.round(Number(value));
    setTable(Number.isFinite(parsed) && parsed >= 1 ? parsed : 1);
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSaveDescription() {
    if (!restaurantId) return;
    setDescriptionStatus("saving");
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        setDescriptionStatus("error");
        return;
      }
      setDescriptionStatus("saved");
      setTimeout(() => setDescriptionStatus("idle"), 1500);
    } catch {
      setDescriptionStatus("error");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>
          {t("subtitle", { name: restaurantName || "—" })}
        </p>

        <div className={styles.qrBlock}>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={link} className={styles.qrImage} width={240} height={240} />
          ) : (
            <div className={styles.qrPlaceholder} />
          )}

          <div className={styles.controls}>
            <label className={styles.field}>
              <span>{t("tableLabel")}</span>
              <input
                type="number"
                min={1}
                value={table}
                onChange={(e) => handleTableChange(e.target.value)}
                className={styles.tableInput}
              />
            </label>

            <div className={styles.field}>
              <span>{t("linkLabel")}</span>
              <div className={styles.linkRow}>
                <code className={styles.linkText}>{link}</code>
                <button type="button" onClick={handleCopy} className={styles.secondaryButton}>
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </div>

            <a
              href={qrDataUrl}
              download={`nezhdi-table-${table}.png`}
              className={styles.primaryButton}
              aria-disabled={!qrDataUrl}
            >
              {t("download")}
            </a>
          </div>
        </div>

        <div className={styles.field}>
          <span>{t("descriptionLabel")}</span>
          <textarea
            className={styles.descriptionInput}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            maxLength={300}
            rows={2}
          />
          <div className={styles.descriptionRow}>
            <button
              type="button"
              onClick={handleSaveDescription}
              className={styles.secondaryButton}
              disabled={descriptionStatus === "saving"}
            >
              {descriptionStatus === "saved" ? t("descriptionSaved") : t("descriptionSave")}
            </button>
            {descriptionStatus === "error" && (
              <span className={styles.descriptionError}>{t("descriptionError")}</span>
            )}
          </div>
        </div>

        <p className={styles.hint}>{t("hint")}</p>
        <Link href="/admin" className={styles.adminLink}>
          {t("adminLink")}
        </Link>
      </div>
    </main>
  );
}
