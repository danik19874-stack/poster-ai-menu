import type { Metadata } from "next";
import { geistSans, geistMono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "ИИ-меню для Poster POS",
  description: "Гостевое меню по QR-коду с ИИ-консультантом по составу блюд.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
