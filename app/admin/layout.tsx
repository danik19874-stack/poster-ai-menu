import type { Metadata } from "next";
import { geistSans, geistMono } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Админка · НеЖди",
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
