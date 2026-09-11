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
}: {
  origin: string;
  restaurantId: string;
  restaurantName: string;
}) {
  const t = useTranslations("Connected");
  const [table, setTable] = useState(1);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

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

        <p className={styles.hint}>{t("hint")}</p>
        <Link href="/admin" className={styles.adminLink}>
          {t("adminLink")}
        </Link>
      </div>
    </main>
  );
}
