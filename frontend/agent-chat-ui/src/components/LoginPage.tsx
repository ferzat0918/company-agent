"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Login page for Company Agent.
 * Uses Supabase email/password auth (no magic link, since it's an internal tool).
 */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "40px",
          background: "rgba(30, 41, 59, 0.8)",
          backdropFilter: "blur(20px)",
          borderRadius: "16px",
          border: "1px solid rgba(148, 163, 184, 0.15)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 16px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            🤖
          </div>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "22px",
              fontWeight: 700,
              color: "#f1f5f9",
            }}
          >
            Company Agent
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
            公司内部智能助手 · 请登录
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "20px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "10px",
              color: "#fca5a5",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="login-email"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#94a3b8",
              }}
            >
              邮箱
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                borderRadius: "10px",
                color: "#e2e8f0",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(99, 102, 241, 0.6)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(148, 163, 184, 0.2)")
              }
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              htmlFor="login-password"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#94a3b8",
              }}
            >
              密码
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                borderRadius: "10px",
                color: "#e2e8f0",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(99, 102, 241, 0.6)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(148, 163, 184, 0.2)")
              }
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading
                ? "rgba(99, 102, 241, 0.4)"
                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          账号由管理员在 Supabase Studio 中创建
        </p>
      </div>
    </div>
  );
}
