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
 * Gate component: shows LoginPage when unauthenticated,
 * shows the agent chat UI when authenticated.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut, user } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#94a3b8",
          fontSize: "16px",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div style={{ position: "relative" }}>
      {/* User badge + sign out button */}
      <div
        style={{
          position: "fixed",
          top: "12px",
          right: "16px",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "6px 14px",
          background: "rgba(30, 41, 59, 0.85)",
          backdropFilter: "blur(12px)",
          borderRadius: "10px",
          border: "1px solid rgba(148, 163, 184, 0.12)",
          fontSize: "13px",
          color: "#94a3b8",
        }}
      >
        <span style={{ color: "#e2e8f0" }}>
          {user?.email ?? "User"}
        </span>
        <button
          onClick={signOut}
          style={{
            padding: "4px 10px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "6px",
            color: "#fca5a5",
            fontSize: "12px",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)")
          }
        >
          退出
        </button>
      </div>
      {children}
    </div>
  );
}

export default function DemoPage(): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading (layout)...</div>}>
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
