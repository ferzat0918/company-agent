"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, AlertCircle, MessageSquarePlus, ListChecks } from "lucide-react";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { UmxSymbol, UmxWordmark } from "@/components/icons/umx-logo";
import { LoginPage } from "@/components/LoginPage";
import { FeedbackModal } from "@/components/FeedbackModal";

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
        INITIALIZING...
      </span>
    </div>
  );
}

type ProfileRow = {
  user_id: string;
  dept: string | null;
  role: string | null;
  region: string | null;
};

function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--umx-acid)]">
        §{index}
      </span>
      <h2 className="m-0 font-display text-xl font-bold uppercase tracking-[0.14em] text-[var(--umx-white)]">
        {title}
      </h2>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-4 border-b border-[var(--umx-line)] px-6 py-4 last:border-b-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
        {label}
      </span>
      <span className="break-all font-mono text-[12px] text-[var(--umx-white)]">
        {value || "—"}
      </span>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="mb-5">
      <label
        htmlFor={id}
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
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder="••••••••"
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "var(--umx-bg-2)",
          border: `1px solid ${focused ? "var(--umx-acid)" : "var(--umx-line)"}`,
          borderRadius: "2px",
          color: "var(--umx-white)",
          fontFamily: "var(--font-body)",
          fontSize: "14px",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxSizing: "border-box",
          boxShadow: focused
            ? "0 0 0 1px var(--umx-acid), 0 0 12px rgba(218, 252, 8, 0.08)"
            : "none",
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  );
}

function AccountInfoCard({ profile }: { profile: ProfileRow | null }) {
  const { user } = useAuth();
  return (
    <section>
      <SectionLabel index="01" title="ACCOUNT" />
      <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)]">
        <InfoRow label="EMAIL" value={user?.email} />
        <InfoRow label="DEPT / 部门" value={profile?.dept || "unknown"} />
        <InfoRow label="ROLE / 角色" value={profile?.role || "—"} />
        <InfoRow label="USER ID" value={user?.id} />
      </div>
    </section>
  );
}

function PasswordCard() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!user?.email) {
      setError("无法获取当前用户邮箱，请重新登录");
      return;
    }
    if (next.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (next !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (next === current) {
      setError("新密码不能与当前密码相同");
      return;
    }

    setLoading(true);

    // Step 1 — verify current password by re-authenticating.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (verifyErr) {
      setLoading(false);
      setError("当前密码错误");
      return;
    }

    // Step 2 — update to the new password.
    const { error: updateErr } = await supabase.auth.updateUser({
      password: next,
    });

    setLoading(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setSuccess(true);
    reset();
  };

  return (
    <section>
      <SectionLabel index="02" title="CHANGE PASSWORD" />
      <form
        onSubmit={handleSubmit}
        className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-6"
      >
        <PasswordField
          id="current-password"
          label="当前密码 / CURRENT"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          disabled={loading}
        />
        <PasswordField
          id="new-password"
          label="新密码 / NEW (≥ 6)"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          disabled={loading}
        />
        <PasswordField
          id="confirm-password"
          label="确认新密码 / CONFIRM"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          disabled={loading}
        />

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-5 flex items-center gap-2 px-3 py-2.5"
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

        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-5 flex items-center gap-2 px-3 py-2.5"
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
            <span>密码已更新</span>
          </motion.div>
        )}

        <Button
          type="submit"
          variant="acid"
          size="lg"
          disabled={loading || !current || !next || !confirm}
          className="w-full"
        >
          {loading ? "UPDATING..." : "UPDATE PASSWORD"}
        </Button>
      </form>
    </section>
  );
}

function FeedbackCard({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <section>
      <SectionLabel index="03" title="FEEDBACK & REQUESTS" />
      <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-6">
        <p
          className="mb-6 font-body text-sm leading-relaxed text-[var(--umx-silver)]"
        >
          遇到问题或有新的功能需求？欢迎提交反馈，我们会尽快处理。
        </p>
        <div className="flex gap-3">
          <Button
            variant="acid"
            size="lg"
            className="flex-1 gap-2"
            onClick={onOpenModal}
          >
            <MessageSquarePlus className="size-4" />
            我要反馈
          </Button>
          <Link href="/profile/feedback" className="flex-1">
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2"
            >
              <ListChecks className="size-4" />
              我的反馈
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, dept, role, region")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data) setProfile(data as ProfileRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <main className="umx-scrollbar min-h-screen overflow-x-hidden bg-[var(--umx-bg-0)] text-[var(--umx-white)]">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b border-[var(--umx-line)] px-8 py-5">
        <div className="flex items-center gap-3">
          <UmxSymbol size={28} className="text-[var(--umx-white)]" />
          <UmxWordmark size={22} />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--umx-text-dim)]">
            · COMPANY AGENT / PROFILE
          </span>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="size-3" />
            BACK TO CHAT
          </Button>
        </Link>
      </header>

      <div className="mx-auto max-w-3xl space-y-12 px-8 py-12">
        <AccountInfoCard profile={profile} />
        <PasswordCard />
        <FeedbackCard onOpenModal={() => setFeedbackOpen(true)} />
      </div>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </main>
  );
}

function ProfileGate() {
  const { session, loading } = useAuth();
  if (loading) return <UmxLoadingScreen />;
  if (!session) return <LoginPage />;
  return <ProfileContent />;
}

export default function ProfilePage() {
  return (
    <React.Suspense fallback={<UmxLoadingScreen />}>
      <AuthProvider>
        <ProfileGate />
      </AuthProvider>
    </React.Suspense>
  );
}
