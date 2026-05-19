"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/Auth";

type FeedbackType = "bug" | "feature";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { user } = useAuth();
  const [type, setType] = useState<FeedbackType>("bug");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setType("bug");
    setContent("");
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("请填写详细内容");
      return;
    }
    if (content.trim().length < 10) {
      setError("内容太短，请描述得更详细一些（至少 10 个字）");
      return;
    }

    setLoading(true);

    const { error: insertErr } = await supabase.from("feedback").insert({
      user_id: user?.id,
      user_email: user?.email,
      type,
      content: content.trim(),
    });

    setLoading(false);

    if (insertErr) {
      setError(`提交失败：${insertErr.message}`);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      handleClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-lg border border-[var(--umx-line)] bg-[var(--umx-bg-1)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--umx-line)] px-6 py-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--umx-acid)]">
                    FEEDBACK
                  </span>
                  <h2 className="m-0 font-display text-lg font-bold uppercase tracking-[0.1em] text-[var(--umx-white)]">
                    提交反馈
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="flex size-8 items-center justify-center text-[var(--umx-text-dim)] transition-colors hover:text-[var(--umx-white)]"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit} className="space-y-5 p-6">
                {/* Type selector */}
                <div>
                  <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--umx-silver)]">
                    类型 / TYPE
                  </label>
                  <div className="relative">
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as FeedbackType)}
                      disabled={loading || success}
                      className="w-full appearance-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-4 py-3 font-body text-sm text-[var(--umx-white)] outline-none transition-colors focus:border-[var(--umx-acid)]"
                      style={{ borderRadius: "2px" }}
                    >
                      <option value="bug">Bug 反馈 / 问题报告</option>
                      <option value="feature">功能需求 / 新增请求</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--umx-text-dim)]">
                      ▾
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--umx-silver)]">
                    详细描述 / DETAILS
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={loading || success}
                    placeholder={
                      type === "bug"
                        ? "请描述你遇到的问题，包括具体步骤和预期结果..."
                        : "请描述你需要的功能，以及使用场景..."
                    }
                    rows={5}
                    className="w-full resize-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-4 py-3 font-body text-sm text-[var(--umx-white)] placeholder:text-[var(--umx-text-dim)] outline-none transition-colors focus:border-[var(--umx-acid)]"
                    style={{ borderRadius: "2px" }}
                  />
                  <div className="mt-1 text-right font-mono text-[10px] text-[var(--umx-text-dim)]">
                    {content.length} 字
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-2 px-3 py-2.5"
                    style={{
                      background: "rgba(255, 59, 59, 0.08)",
                      border: "1px solid rgba(255, 59, 59, 0.25)",
                      borderRadius: "2px",
                      color: "#ff6b6b",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Success */}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-2 px-3 py-2.5"
                    style={{
                      background: "rgba(218, 252, 8, 0.06)",
                      border: "1px solid rgba(218, 252, 8, 0.35)",
                      borderRadius: "2px",
                      color: "var(--umx-acid)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <Check className="size-3.5 shrink-0" />
                    <span>提交成功！感谢你的反馈</span>
                  </motion.div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  variant="acid"
                  size="lg"
                  disabled={loading || success || !content.trim()}
                  className="w-full gap-2"
                >
                  {loading ? (
                    "SUBMITTING..."
                  ) : success ? (
                    "SUBMITTED"
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      SUBMIT
                    </>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
