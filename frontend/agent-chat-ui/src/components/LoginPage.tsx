"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

/* ──────────────────────────────────────────────────────────
   UMX X 图形 LOGO (logo-symbol-X.svg — 白色版)
   直接内联 SVG, 避免额外资源请求
   ────────────────────────────────────────────────────────── */
function UmxSymbol({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="UMX"
    >
      <path
        d="M80 80H68.42L68.26 79.75C62.05 70.07 51.49 64.28 40 64.28C28.51 64.28 17.95 70.06 11.74 79.75L11.58 80H0V68.5L0.25 68.34C10.01 62.15 15.84 51.55 15.84 40C15.84 28.45 10.01 17.86 0.25 11.66L0 11.5V0H11.46L11.62 0.26C17.81 10.06 28.42 15.92 40 15.92C51.58 15.92 62.19 10.07 68.38 0.26L68.54 0H80V11.59L79.75 11.75C70.07 17.96 64.29 28.52 64.29 40C64.29 51.48 70.07 62.04 79.75 68.25L80 68.41V80ZM69.02 78.9H78.91V69.01C69.07 62.58 63.2 51.76 63.2 40C63.2 28.24 69.07 17.42 78.91 10.99V1.1H69.15C62.74 11.07 51.86 17.01 40.01 17.01C28.16 17.01 17.28 11.07 10.87 1.1H1.11V10.9C11.04 17.32 16.96 28.17 16.96 40C16.96 51.83 11.04 62.68 1.11 69.1V78.9H11C17.43 69.05 28.25 63.18 40.02 63.18C51.79 63.18 62.61 69.05 69.04 78.9H69.02Z"
        fill="white"
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   UMX 文字 LOGO 词标 (logo-wordmark.svg — 白色版)
   ────────────────────────────────────────────────────────── */
function UmxWordmark({ width = 130 }: { width?: number }) {
  const aspect = 174 / 54;
  const h = width / aspect;
  return (
    <svg
      width={width}
      height={h}
      viewBox="393 311 174 55"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="UMX wordmark"
    >
      <path
        d="M446.42 311.88V318.56H443.08V351.95H439.58L436.4 358.71V365.3H403.02V358.84L399.78 351.95H396.34V318.56H393V311.88H406.35V318.56H403.02V351.7L406.27 358.63H433.09L436.4 351.57V318.56H433.06V311.88H446.42Z"
        fill="white"
      />
      <path
        d="M558.87 331.91L543.78 338.33L560.09 345.27H563.28V358.63H566.62V365.3H553.26V358.63H556.6V347.09L539.91 339.98L523.21 347.09V358.63H526.55V365.3H513.2V358.63H516.53V345.27H519.73L536.03 338.33L520.94 331.91H516.53V318.56H513.2V311.88H526.55V318.56H523.21V329.58L539.91 336.69L556.6 329.58V318.56H553.26V311.88H566.62V318.56H563.28V331.91H558.87Z"
        fill="white"
      />
      <path
        d="M494.91 318.56H493.16V311.88H506.52V318.56H503.18V358.63H506.52V365.3H493.16V358.63H496.5V321.9L483.25 345.27H486.49V351.95H473.13V345.27H476.37L463.11 321.81V358.63H466.45V365.3H453.1V358.63H456.44V318.56H453.1V311.88H466.45V318.56H464.76L479.81 345.27"
        fill="white"
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   扫描线动画 — 赛博朋克 / 机械美学
   ────────────────────────────────────────────────────────── */
function ScanLine() {
  return (
    <motion.div
      className="pointer-events-none absolute left-0 right-0 h-[1px]"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, var(--umx-acid) 30%, var(--umx-acid) 70%, transparent 100%)",
        opacity: 0.12,
      }}
      animate={{ top: ["0%", "100%"] }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

/**
 * UMX 品牌登录页
 *
 * 设计依据:
 * - 色彩: 黑色背景 (#000) + 银色点阵 (#D3D3D4) + 荧光绿 CTA (#DAFC08)
 * - 字体: Roboto Bold (标题 UPPERCASE) / MiSans (正文)
 * - 交互: 圆角矩形按钮、毛玻璃面板 (Glass 32px)、极简线框
 * - 调性: 机械感、硬核、未来感、赛博朋克
 */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{
        background: "var(--umx-black)",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* ── 银色点阵背景 (VI §6 Frame 9) ── */}
      <div
        className="umx-dot-grid-screen pointer-events-none absolute inset-0"
        style={{ "--umx-grid-cy": "50%" } as React.CSSProperties}
      />

      {/* ── 扫描线 ── */}
      <ScanLine />

      {/* ── 左上角荧光绿装饰线 ── */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-[2px]"
        style={{
          width: "180px",
          background:
            "linear-gradient(90deg, var(--umx-acid) 0%, transparent 100%)",
          opacity: 0.6,
        }}
      />
      <div
        className="pointer-events-none absolute left-0 top-0 w-[2px]"
        style={{
          height: "180px",
          background:
            "linear-gradient(180deg, var(--umx-acid) 0%, transparent 100%)",
          opacity: 0.6,
        }}
      />

      {/* ── 右下角荧光紫装饰线 ── */}
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[2px]"
        style={{
          width: "120px",
          background:
            "linear-gradient(270deg, var(--umx-violet) 0%, transparent 100%)",
          opacity: 0.4,
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 w-[2px]"
        style={{
          height: "120px",
          background:
            "linear-gradient(0deg, var(--umx-violet) 0%, transparent 100%)",
          opacity: 0.4,
        }}
      />

      {/* ── 左下角小标签 ── */}
      <div
        className="absolute bottom-6 left-6 select-none"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "var(--umx-silver)",
          opacity: 0.35,
          textTransform: "uppercase",
        }}
      >
        UMX · COMPANY AGENT v1.0
      </div>

      {/* ── 右下角小标签 ── */}
      <div
        className="absolute bottom-6 right-6 select-none"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "var(--umx-silver)",
          opacity: 0.35,
          textTransform: "uppercase",
        }}
      >
        FUTURISM / RETRO-FUTURISM
      </div>

      {/* ── 主登录面板 ── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="umx-glass relative z-10 w-full max-w-[400px] mx-4"
        style={{
          padding: "48px 40px 40px",
          borderRadius: "4px", // 机械感: 微圆角
        }}
      >
        {/* 面板顶部荧光绿指示线 */}
        <div
          className="absolute left-0 right-0 top-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, var(--umx-acid) 20%, var(--umx-acid) 80%, transparent 100%)",
            borderRadius: "4px 4px 0 0",
          }}
        />

        {/* ── Header: Logo + Title ── */}
        <div className="mb-10 flex flex-col items-center">
          {/* X 图形符号 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-4"
          >
            <UmxSymbol size={52} />
          </motion.div>

          {/* UMX 文字词标 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mb-6"
          >
            <UmxWordmark width={110} />
          </motion.div>

          {/* 子标题 */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.16em",
              color: "var(--umx-silver)",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            COMPANY AGENT · LOGIN
          </motion.p>
        </div>

        {/* ── Error ── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            style={{
              padding: "10px 14px",
              marginBottom: "20px",
              background: "rgba(255, 59, 59, 0.08)",
              border: "1px solid rgba(255, 59, 59, 0.25)",
              borderRadius: "2px",
              color: "#ff6b6b",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.04em",
            }}
          >
            {error}
          </motion.div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleLogin}>
          {/* Email */}
          <div className="mb-5">
            <label
              htmlFor="login-email"
              style={{
                display: "block",
                marginBottom: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.14em",
                color: "var(--umx-silver)",
                textTransform: "uppercase",
              }}
            >
              EMAIL
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "var(--umx-bg-2)",
                border: `1px solid ${focused === "email" ? "var(--umx-acid)" : "var(--umx-line)"}`,
                borderRadius: "2px",
                color: "var(--umx-white)",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxSizing: "border-box",
                boxShadow:
                  focused === "email"
                    ? "0 0 0 1px var(--umx-acid), 0 0 12px rgba(218, 252, 8, 0.08)"
                    : "none",
              }}
            />
          </div>

          {/* Password */}
          <div className="mb-7">
            <label
              htmlFor="login-password"
              style={{
                display: "block",
                marginBottom: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.14em",
                color: "var(--umx-silver)",
                textTransform: "uppercase",
              }}
            >
              PASSWORD
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "var(--umx-bg-2)",
                border: `1px solid ${focused === "password" ? "var(--umx-acid)" : "var(--umx-line)"}`,
                borderRadius: "2px",
                color: "var(--umx-white)",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxSizing: "border-box",
                boxShadow:
                  focused === "password"
                    ? "0 0 0 1px var(--umx-acid), 0 0 12px rgba(218, 252, 8, 0.08)"
                    : "none",
              }}
            />
          </div>

          {/* Submit Button — 荧光绿 CTA */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={loading ? {} : { scale: 1.01 }}
            whileTap={loading ? {} : { scale: 0.98 }}
            style={{
              width: "100%",
              padding: "14px",
              background: loading
                ? "rgba(218, 252, 8, 0.25)"
                : "var(--umx-acid)",
              border: "none",
              borderRadius: "2px",
              color: "var(--umx-black)",
              fontFamily: "var(--font-display)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s, opacity 0.2s",
            }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    display: "inline-block",
                    width: "14px",
                    height: "14px",
                    border: "2px solid transparent",
                    borderTopColor: "var(--umx-black)",
                    borderRadius: "50%",
                  }}
                />
                AUTHENTICATING...
              </span>
            ) : (
              "LOGIN"
            )}
          </motion.button>
        </form>

        {/* 底部提示 */}
        <p
          className="mt-6 text-center"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.1em",
            color: "var(--umx-text-dim)",
            textTransform: "uppercase",
            margin: "24px 0 0",
          }}
        >
          账号由管理员创建
        </p>
      </motion.div>
    </div>
  );
}
