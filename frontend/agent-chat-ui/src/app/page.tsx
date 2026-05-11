"use client";

import { Thread } from "@/components/thread";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { ArtifactProvider } from "@/components/thread/artifact";
import { LoginPage } from "@/components/LoginPage";
import { Toaster } from "@/components/ui/sonner";
import React from "react";

/**
 * UMX 品牌加载界面 — X 符号脉冲 + 银色文字
 */
function UmxLoadingScreen() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center"
      style={{
        background: "var(--umx-black)",
      }}
    >
      {/* X 符号脉冲 */}
      <svg
        width={40}
        height={40}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: "umx-pulse 2s ease-in-out infinite",
        }}
      >
        <path
          d="M80 80H68.42L68.26 79.75C62.05 70.07 51.49 64.28 40 64.28C28.51 64.28 17.95 70.06 11.74 79.75L11.58 80H0V68.5L0.25 68.34C10.01 62.15 15.84 51.55 15.84 40C15.84 28.45 10.01 17.86 0.25 11.66L0 11.5V0H11.46L11.62 0.26C17.81 10.06 28.42 15.92 40 15.92C51.58 15.92 62.19 10.07 68.38 0.26L68.54 0H80V11.59L79.75 11.75C70.07 17.96 64.29 28.52 64.29 40C64.29 51.48 70.07 62.04 79.75 68.25L80 68.41V80ZM69.02 78.9H78.91V69.01C69.07 62.58 63.2 51.76 63.2 40C63.2 28.24 69.07 17.42 78.91 10.99V1.1H69.15C62.74 11.07 51.86 17.01 40.01 17.01C28.16 17.01 17.28 11.07 10.87 1.1H1.11V10.9C11.04 17.32 16.96 28.17 16.96 40C16.96 51.83 11.04 62.68 1.11 69.1V78.9H11C17.43 69.05 28.25 63.18 40.02 63.18C51.79 63.18 62.61 69.05 69.04 78.9H69.02Z"
          fill="var(--umx-silver)"
        />
      </svg>
      <p
        style={{
          marginTop: "16px",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.16em",
          color: "var(--umx-text-dim)",
          textTransform: "uppercase",
        }}
      >
        INITIALIZING...
      </p>

      {/* Keyframe for pulse */}
      <style>{`
        @keyframes umx-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

/**
 * Gate component: shows LoginPage when unauthenticated,
 * shows the agent chat UI when authenticated.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <UmxLoadingScreen />;
  }

  if (!session) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

export default function DemoPage(): React.ReactNode {
  return (
    <React.Suspense fallback={<UmxLoadingScreen />}>
      <Toaster />
      <AuthProvider>
        <AuthGate>
          <ThreadProvider>
            <StreamProvider>
              <ArtifactProvider>
                <Thread />
              </ArtifactProvider>
            </StreamProvider>
          </ThreadProvider>
        </AuthGate>
      </AuthProvider>
    </React.Suspense>
  );
}
