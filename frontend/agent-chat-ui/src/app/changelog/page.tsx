"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { UmxSymbol, UmxWordmark } from "@/components/icons/umx-logo";
import { LoginPage } from "@/components/LoginPage";
import { NavLinks } from "@/components/nav-links";

function UmxLoadingScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--umx-black)" }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.16em",
          color: "var(--umx-text-dim)",
          textTransform: "uppercase",
        }}
      >
        LOADING CHANGELOG...
      </span>
    </div>
  );
}

function ChangelogContent() {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/CHANGELOG.md", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(setContent)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="umx-scrollbar min-h-screen overflow-x-hidden bg-[var(--umx-bg-0)] text-[var(--umx-white)]">
      <header className="flex items-center justify-between border-b border-[var(--umx-line)] px-8 py-5">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <UmxSymbol size={28} className="text-[var(--umx-white)]" />
          <UmxWordmark size={22} />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
            · COMPANY AGENT / CHANGELOG
          </span>
        </Link>
        <NavLinks />
      </header>

      <div className="mx-auto max-w-3xl px-8 py-12">
        {content === null && error === null && (
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
            FETCHING /CHANGELOG.md ...
          </p>
        )}

        {error && (
          <div
            className="border px-4 py-3"
            style={{
              background: "rgba(255, 59, 59, 0.06)",
              borderColor: "rgba(255, 59, 59, 0.25)",
              color: "#ff6b6b",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
            }}
          >
            加载更新日志失败：{error}
          </div>
        )}

        {content !== null && (
          <article className="umx-changelog">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </article>
        )}
      </div>

      {/* 局部样式 —— 让 react-markdown 输出贴 UMX 调性 */}
      <style jsx global>{`
        .umx-changelog h1 {
          font-family: var(--font-display);
          font-size: 36px;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.01em;
          text-transform: uppercase;
          color: var(--umx-white);
          margin: 0 0 32px;
          padding-bottom: 16px;
          border-bottom: 2px solid var(--umx-white);
        }
        .umx-changelog h2 {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--umx-white);
          background: var(--umx-bg-1);
          border: 1px solid var(--umx-line);
          border-left: 3px solid var(--umx-acid);
          padding: 12px 18px;
          margin: 48px 0 24px;
        }
        .umx-changelog h3 {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--umx-acid);
          margin: 28px 0 12px;
          padding-bottom: 6px;
          border-bottom: 1px dashed var(--umx-line);
        }
        .umx-changelog h4 {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--umx-silver);
          margin: 20px 0 8px;
        }
        .umx-changelog p {
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.7;
          color: var(--umx-silver);
          margin: 12px 0 16px;
        }
        .umx-changelog strong {
          color: var(--umx-white);
          font-weight: 600;
        }
        .umx-changelog ul {
          margin: 8px 0 20px;
          padding-left: 0;
          list-style: none;
        }
        .umx-changelog li {
          position: relative;
          font-size: 13px;
          line-height: 1.6;
          color: var(--umx-white);
          margin: 8px 0;
          padding-left: 20px;
        }
        .umx-changelog li::before {
          content: "//";
          position: absolute;
          left: 0;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: bold;
          color: var(--umx-acid);
        }
        .umx-changelog code {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 2px 6px;
          background: var(--umx-bg-2);
          color: var(--umx-acid);
          border: 1px solid var(--umx-line);
          border-radius: var(--radius);
          text-transform: none;
        }
        .umx-changelog pre {
          background: var(--umx-bg-1);
          border: 1px solid var(--umx-line);
          padding: 16px;
          border-radius: var(--radius);
          margin: 16px 0;
          overflow-x: auto;
        }
        .umx-changelog pre code {
          background: transparent;
          border: none;
          padding: 0;
          color: var(--umx-white);
          font-size: 11px;
          text-transform: none;
        }
        .umx-changelog a {
          color: var(--umx-acid);
          text-decoration: none;
          border-bottom: 1px solid var(--umx-acid);
          transition: opacity 0.15s ease;
        }
        .umx-changelog a:hover {
          opacity: 0.8;
        }
        .umx-changelog hr {
          border: none;
          border-top: 1px solid var(--umx-line);
          margin: 32px 0;
        }
        .umx-changelog table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid var(--umx-line);
          margin: 24px 0;
          font-size: 13px;
        }
        .umx-changelog th {
          background: var(--umx-bg-2);
          border: 1px solid var(--umx-line);
          padding: 10px 14px;
          color: var(--umx-white);
          font-family: var(--font-display);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-align: left;
        }
        .umx-changelog td {
          border: 1px solid var(--umx-line);
          padding: 10px 14px;
          color: var(--umx-silver);
          line-height: 1.5;
        }
        .umx-changelog tr:nth-child(even) {
          background: rgba(255, 255, 255, 0.01);
        }
        .light .umx-changelog tr:nth-child(even) {
          background: rgba(0, 0, 0, 0.01);
        }
        .umx-changelog blockquote {
          border-left: 3px solid var(--umx-violet);
          padding: 12px 20px;
          background: var(--umx-bg-1);
          border-top: 1px solid var(--umx-line);
          border-right: 1px solid var(--umx-line);
          border-bottom: 1px solid var(--umx-line);
          margin: 20px 0;
        }
        .umx-changelog blockquote p {
          margin: 0;
          font-size: 13px;
          color: var(--umx-text-dim);
          font-style: normal;
        }
      `}</style>
    </main>
  );
}

function ChangelogGate() {
  const { session, loading } = useAuth();
  if (loading) return <UmxLoadingScreen />;
  if (!session) return <LoginPage />;
  return <ChangelogContent />;
}

export default function ChangelogPage() {
  return (
    <React.Suspense fallback={<UmxLoadingScreen />}>
      <AuthProvider>
        <ChangelogGate />
      </AuthProvider>
    </React.Suspense>
  );
}
