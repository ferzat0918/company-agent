"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { Button } from "@/components/ui/button";
import { UmxSymbol, UmxWordmark } from "@/components/icons/umx-logo";
import { LoginPage } from "@/components/LoginPage";

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
        <div className="flex items-center gap-3">
          <UmxSymbol size={28} className="text-[var(--umx-white)]" />
          <UmxWordmark size={22} />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
            · COMPANY AGENT / CHANGELOG
          </span>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="size-3" />
            BACK TO CHAT
          </Button>
        </Link>
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
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--umx-white);
          margin: 0 0 24px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--umx-line);
        }
        .umx-changelog h2 {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--umx-acid);
          margin: 36px 0 12px;
          padding-bottom: 8px;
          border-bottom: 1px dashed var(--umx-line);
        }
        .umx-changelog h3 {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--umx-silver);
          margin: 20px 0 8px;
        }
        .umx-changelog p {
          font-size: 14px;
          line-height: 1.7;
          color: var(--umx-silver);
          margin: 8px 0 16px;
        }
        .umx-changelog ul {
          margin: 4px 0 16px;
          padding-left: 20px;
          list-style: none;
        }
        .umx-changelog li {
          position: relative;
          font-size: 14px;
          line-height: 1.6;
          color: var(--umx-white);
          margin: 4px 0;
          padding-left: 8px;
        }
        .umx-changelog li::before {
          content: "▸";
          position: absolute;
          left: -12px;
          color: var(--umx-text-dim);
        }
        .umx-changelog code {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 1px 6px;
          background: var(--umx-bg-2);
          color: var(--umx-text-dim);
          border-radius: 2px;
        }
        .umx-changelog pre {
          background: var(--umx-bg-1);
          border: 1px solid var(--umx-line);
          padding: 12px;
          border-radius: 2px;
          overflow-x: auto;
        }
        .umx-changelog pre code {
          background: transparent;
          font-size: 12px;
        }
        .umx-changelog a {
          color: var(--umx-acid);
          text-decoration: underline;
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
