"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { UmxSymbol, UmxWordmark } from "@/components/icons/umx-logo";
import { LoginPage } from "@/components/LoginPage";
import { NavLinks } from "@/components/nav-links";
import { supabase } from "@/lib/supabase";

const ChangelogRenderer = dynamic(() => import("@/components/ChangelogRenderer"), {
  ssr: false,
  loading: () => (
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
      GENERATING LOGS...
    </p>
  ),
});

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
    async function loadChangelog() {
      try {
        // 1. 优先尝试从 Supabase 数据库加载动态更新日志
        const { data, error: dbErr } = await supabase
          .from("changelog_entries")
          .select("*")
          .order("release_date", { ascending: false })
          .order("version", { ascending: false });
        if (!dbErr && data && data.length > 0) {
          // 在前端显式做一次极度可靠的降序排序，新发布/最近日期在上
          const sortedData = [...data].sort((a, b) => {
            const dateA = new Date(a.release_date).getTime();
            const dateB = new Date(b.release_date).getTime();
            if (dateA !== dateB) return dateB - dateA;
            return b.version.localeCompare(a.version);
          });

          // 动态拼接 Markdown 字符串，将转义的字面量 \n 替换为实际换行符
          const markdown = sortedData
            .map((entry) => {
              const cleanContent = (entry.content || "").replace(/\\n/g, "\n");
              return `# ${entry.version} — ${entry.title}\n*发布日期: ${entry.release_date}*\n\n${cleanContent}`;
            })
            .join("\n\n---\n\n");
          setContent(markdown);
          return;
        }
        // 2. 如果数据库中无数据，或者发生查询错误，优雅退避至加载静态 CHANGELOG.md
        const res = await fetch("/CHANGELOG.md", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        setContent(text);
      } catch (e) {
        setError(String(e));
      }
    }

    loadChangelog();
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
          <ChangelogRenderer content={content} />
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
