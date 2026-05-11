import type { Metadata } from "next";
import "./globals.css";
import { Roboto, JetBrains_Mono } from "next/font/google";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-roboto",
  preload: true,
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  preload: true,
  display: "swap",
});

export const metadata: Metadata = {
  title: "UMX · COMPANY AGENT",
  description: "UMX 公司内部智能助手 — Futurism / Retro-Futurism",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`dark ${roboto.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
