"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Check, AlertCircle, Paperclip, Upload,
  FileText, FileSpreadsheet, Music, Film, Image as ImageIcon, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/Auth";

/* ── Constants ──────────────────────────────────────────────────── */

type FeedbackType = "bug" | "feature";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "video/mp4", "video/quicktime",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg", "audio/wav",
];

const ACCEPT_STRING = ACCEPTED_TYPES.join(",");

export interface AttachmentMeta {
  name: string;
  path: string;
  size: number;
  type: string;
}

/* ── Helpers ────────────────────────────────────────────────────── */

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="size-4" />;
  if (mime.startsWith("video/")) return <Film className="size-4" />;
  if (mime.startsWith("audio/")) return <Music className="size-4" />;
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return <FileSpreadsheet className="size-4" />;
  return <FileText className="size-4" />;
}

/* ── Component ──────────────────────────────────────────────────── */

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { user } = useAuth();
  const [type, setType] = useState<FeedbackType>("bug");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── File management ──────────────────────────────────────────── */

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      const validFiles: File[] = [];
      for (const f of arr) {
        if (files.length + validFiles.length >= MAX_FILES) {
          setError(`最多上传 ${MAX_FILES} 个附件`);
          break;
        }
        if (f.size > MAX_FILE_SIZE) {
          setError(`${f.name} 超出 50 MB 限制`);
          continue;
        }
        validFiles.push(f);
      }

      // Generate previews for images
      const newPreviews: string[] = [];
      for (const f of validFiles) {
        if (f.type.startsWith("image/")) {
          newPreviews.push(URL.createObjectURL(f));
        } else {
          newPreviews.push("");
        }
      }

      setFiles((prev) => [...prev, ...validFiles]);
      setPreviews((prev) => [...prev, ...newPreviews]);
    },
    [files.length],
  );

  const removeFile = (idx: number) => {
    if (previews[idx]) URL.revokeObjectURL(previews[idx]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── Drag & drop ──────────────────────────────────────────────── */

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  /* ── Reset ────────────────────────────────────────────────────── */

  const reset = () => {
    setType("bug");
    setContent("");
    previews.forEach((p) => p && URL.revokeObjectURL(p));
    setFiles([]);
    setPreviews([]);
    setUploadProgress(0);
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  /* ── Submit ───────────────────────────────────────────────────── */

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

    // Step 1: Upload files to Supabase Storage
    const attachments: AttachmentMeta[] = [];
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ts = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const filePath = `${user?.id}/${yearMonth}/${ts}_${safeName}`;

        setUploadProgress(Math.round(((i) / files.length) * 100));

        const { error: uploadErr } = await supabase.storage
          .from("feedback-attachments")
          .upload(filePath, file, { upsert: false });

        if (uploadErr) {
          setLoading(false);
          setError(`文件 ${file.name} 上传失败：${uploadErr.message}`);
          return;
        }

        attachments.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type,
        });
      }
      setUploadProgress(100);
    }

    // Step 2: Insert feedback record
    const { error: insertErr } = await supabase.from("feedback").insert({
      user_id: user?.id,
      user_email: user?.email,
      type,
      content: content.trim(),
      attachments,
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

  /* ── Render ───────────────────────────────────────────────────── */

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
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[var(--umx-line)] bg-[var(--umx-bg-1)] umx-scrollbar"
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
                    rows={4}
                    className="w-full resize-none border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-4 py-3 font-body text-sm text-[var(--umx-white)] placeholder:text-[var(--umx-text-dim)] outline-none transition-colors focus:border-[var(--umx-acid)]"
                    style={{ borderRadius: "2px" }}
                  />
                  <div className="mt-1 text-right font-mono text-[10px] text-[var(--umx-text-dim)]">
                    {content.length} 字
                  </div>
                </div>

                {/* ── Attachments area ─────────────────────────────── */}
                <div>
                  <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--umx-silver)]">
                    附件 / ATTACHMENTS
                    <span className="ml-2 normal-case tracking-normal text-[var(--umx-text-dim)]">
                      ({files.length}/{MAX_FILES})
                    </span>
                  </label>

                  {/* Drop zone */}
                  {files.length < MAX_FILES && !loading && !success && (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-5 transition-colors"
                      style={{
                        borderColor: dragging
                          ? "var(--umx-acid)"
                          : "var(--umx-line)",
                        background: dragging
                          ? "rgba(218,252,8,0.04)"
                          : "var(--umx-bg-2)",
                        borderRadius: "2px",
                      }}
                    >
                      <Upload
                        className="size-5"
                        style={{
                          color: dragging
                            ? "var(--umx-acid)"
                            : "var(--umx-text-dim)",
                        }}
                      />
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.1em]"
                        style={{
                          color: dragging
                            ? "var(--umx-acid)"
                            : "var(--umx-text-dim)",
                        }}
                      >
                        拖拽文件到此处 / 点击选择
                      </span>
                      <span className="font-mono text-[9px] text-[var(--umx-text-dim)]">
                        图片 · 视频 · PDF · Excel · MP3 — 单个最大 50MB
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ACCEPT_STRING}
                        onChange={(e) => {
                          if (e.target.files) addFiles(e.target.files);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* File list */}
                  {files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {files.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-3 border border-[var(--umx-line)] bg-[var(--umx-bg-2)] px-3 py-2"
                          style={{ borderRadius: "2px" }}
                        >
                          {/* Thumbnail or icon */}
                          {previews[i] ? (
                            <img
                              src={previews[i]}
                              alt={f.name}
                              className="size-9 shrink-0 rounded-sm object-cover"
                            />
                          ) : (
                            <div className="flex size-9 shrink-0 items-center justify-center bg-[var(--umx-bg-0)] text-[var(--umx-text-dim)]"
                              style={{ borderRadius: "2px" }}
                            >
                              {fileIcon(f.type)}
                            </div>
                          )}

                          {/* Name + size */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-body text-xs text-[var(--umx-white)]">
                              {f.name}
                            </p>
                            <p className="font-mono text-[9px] text-[var(--umx-text-dim)]">
                              {humanSize(f.size)}
                            </p>
                          </div>

                          {/* Remove */}
                          {!loading && !success && (
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              className="flex size-6 shrink-0 items-center justify-center text-[var(--umx-text-dim)] transition-colors hover:text-[#ff6b6b]"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload progress */}
                  {loading && files.length > 0 && uploadProgress < 100 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between font-mono text-[10px] text-[var(--umx-text-dim)]">
                        <span>UPLOADING...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div
                        className="mt-1 h-1 w-full overflow-hidden"
                        style={{
                          background: "var(--umx-bg-2)",
                          borderRadius: "1px",
                        }}
                      >
                        <motion.div
                          className="h-full"
                          style={{ background: "var(--umx-acid)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  )}
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
                    files.length > 0 && uploadProgress < 100
                      ? `UPLOADING ${uploadProgress}%...`
                      : "SUBMITTING..."
                  ) : success ? (
                    "SUBMITTED"
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      SUBMIT
                      {files.length > 0 && (
                        <span className="ml-1 flex items-center gap-1 text-[10px] opacity-70">
                          <Paperclip className="size-3" />
                          {files.length}
                        </span>
                      )}
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
