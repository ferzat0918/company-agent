"use client";

import "./markdown-styles.css";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { FC, memo, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { SyntaxHighlighter } from "@/components/thread/syntax-highlighter";

import { TooltipIconButton } from "@/components/thread/tooltip-icon-button";
import { cn } from "@/lib/utils";

import "katex/dist/katex.min.css";


interface CodeHeaderProps {
  language?: string;
  code: string;
}

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-t-[2px] border border-b-0 border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--umx-silver)]">
      <span className="lowercase [&>span]:text-xs">{language}</span>
      <TooltipIconButton
        tooltip="Copy"
        onClick={onCopy}
      >
        {!isCopied && <CopyIcon />}
        {isCopied && <CheckIcon />}
      </TooltipIconButton>
    </div>
  );
};

function MarkdownImage({
  src,
  alt,
}: {
  src?: string;
  alt?: string;
}) {
  // Rewrite paths so nginx can serve skill assets:
  //   file:///skills/...  →  /skills/...   (strip file:// protocol)
  //   skills/...          →  /skills/...   (prepend /)
  //   http(s)://... or data:... or /...    →  keep as-is
  let resolvedSrc = src ?? "";
  if (resolvedSrc.startsWith("file:///")) {
    resolvedSrc = resolvedSrc.replace("file://", "");
  } else if (
    !resolvedSrc.startsWith("http") &&
    !resolvedSrc.startsWith("data:") &&
    !resolvedSrc.startsWith("/")
  ) {
    resolvedSrc = `/${resolvedSrc}`;
  }

  const isSvg = resolvedSrc.toLowerCase().endsWith(".svg");
  const [bgMode, setBgMode] = useState<"light" | "dark">(isSvg ? "light" : "light");
  const [autoDetected, setAutoDetected] = useState(false);

  const isLight = bgMode === "light";

  if (!src) return null;

  return (
    <div className="group/img relative my-3 inline-block max-w-full">
      <div
        className="overflow-hidden rounded-[4px] border border-[var(--umx-line)] p-2 transition-colors duration-200"
        style={{
          background: isLight
            ? "linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)"
            : "transparent",
        }}
      >
        <img
          src={resolvedSrc}
          alt={alt || "image"}
          loading="lazy"
          className="max-w-full rounded-[2px]"
          style={{ maxHeight: "480px" }}
          onLoad={(e) => {
            if (isSvg || autoDetected) return;
            // Detect image brightness using Canvas
            try {
              const img = e.currentTarget;
              const canvas = document.createElement("canvas");
              const size = 32;
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext("2d");
              if (!ctx) return;
              ctx.drawImage(img, 0, 0, size, size);
              const data = ctx.getImageData(0, 0, size, size).data;
              let totalBrightness = 0;
              let opaquePixels = 0;
              for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 30) continue;
                opaquePixels++;
                totalBrightness +=
                  0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              }
              const avgBright =
                opaquePixels > 0 ? totalBrightness / opaquePixels : 128;
              // Bright image → no need for light bg
              if (avgBright > 140) setBgMode("dark");
              setAutoDetected(true);
            } catch {
              setAutoDetected(true);
            }
          }}
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const fallback = document.createElement("div");
            fallback.className =
              "flex items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]";
            fallback.textContent = `⚠ IMAGE UNAVAILABLE: ${alt || src}`;
            target.parentNode?.insertBefore(fallback, target.nextSibling);
          }}
        />
      </div>
      {/* Light/Dark toggle — visible on hover */}
      <button
        type="button"
        onClick={() => setBgMode((m) => (m === "light" ? "dark" : "light"))}
        className="absolute right-2 top-2 rounded-full border border-[var(--umx-line)] bg-[var(--umx-bg)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--umx-text-dim)] opacity-0 transition-opacity group-hover/img:opacity-100"
      >
        {isLight ? "◐ DARK" : "◑ LIGHT"}
      </button>
    </div>
  );
}

const defaultComponents: any = {
  h1: ({ className, ...props }: { className?: string }) => (
    <h1
      className={cn(
        "mb-8 scroll-m-20 text-4xl font-extrabold tracking-tight last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: { className?: string }) => (
    <h2
      className={cn(
        "mt-8 mb-4 scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: { className?: string }) => (
    <h3
      className={cn(
        "mt-6 mb-4 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }: { className?: string }) => (
    <h4
      className={cn(
        "mt-6 mb-4 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }: { className?: string }) => (
    <h5
      className={cn(
        "my-4 text-lg font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }: { className?: string }) => (
    <h6
      className={cn("my-4 font-semibold first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }: { className?: string }) => (
    <p
      className={cn("mt-5 mb-5 leading-7 first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }: { className?: string }) => (
    <a
      className={cn(
        "text-primary font-medium underline underline-offset-4",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }: { className?: string }) => (
    <blockquote
      className={cn("border-l-2 pl-6 italic", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }: { className?: string }) => (
    <ul
      className={cn("my-5 ml-6 list-disc [&>li]:mt-2", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }: { className?: string }) => (
    <ol
      className={cn("my-5 ml-6 list-decimal [&>li]:mt-2", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }: { className?: string }) => (
    <hr
      className={cn("my-5 border-b", className)}
      {...props}
    />
  ),
  // 表格样式全部在 markdown-styles.css 里，JSX 不再叠加类，
  // 只保留 align 属性映射（GFM 表格语法支持的 :---:, ---: 对齐）。
  table: ({ className, ...props }: { className?: string }) => (
    <table className={className} {...props} />
  ),
  th: ({ className, ...props }: { className?: string }) => (
    <th
      className={cn(
        "[&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: { className?: string }) => (
    <td
      className={cn(
        "[&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }: { className?: string }) => (
    <tr className={className} {...props} />
  ),
  sup: ({ className, ...props }: { className?: string }) => (
    <sup
      className={cn("[&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  img: MarkdownImage,
  pre: ({ className, ...props }: { className?: string }) => (
    <pre
      className={cn(
        "max-w-4xl overflow-x-auto rounded-lg bg-black text-white",
        className,
      )}
      {...props}
    />
  ),
  code: ({
    className,
    children,
    ...props
  }: {
    className?: string;
    children: React.ReactNode;
  }) => {
    const match = /language-(\w+)/.exec(className || "");

    if (match) {
      const language = match[1];
      const code = String(children).replace(/\n$/, "");

      return (
        <>
          <CodeHeader
            language={language}
            code={code}
          />
          <SyntaxHighlighter
            language={language}
            className={className}
          >
            {code}
          </SyntaxHighlighter>
        </>
      );
    }

    return (
      <code
        className={cn("rounded font-semibold", className)}
        {...props}
      >
        {children}
      </code>
    );
  },
};

const MarkdownTextImpl: FC<{ children: string }> = ({ children }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={defaultComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
