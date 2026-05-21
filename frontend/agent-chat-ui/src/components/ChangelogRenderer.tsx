"use client";

import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChangelogRendererProps {
  content: string;
}

export default function ChangelogRenderer({ content }: ChangelogRendererProps) {
  return (
    <article className="umx-changelog">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </article>
  );
}
