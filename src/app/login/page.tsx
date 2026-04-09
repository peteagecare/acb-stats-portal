"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

type Tab = "email" | "authenticator";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const initialError = params.get("error") === "invalid"
    ? "That sign-in link has expired or is invalid. Request a new one below."
    : null;

  const [tab, setTab] = useState<Tab>("authenticator");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking">("idle");
  const [error, setError] = useState<string | null>(initialError);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/login/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not send sign-in link.");
        setEmailStatus("idle");
        return;
      }
      setEmailStatus("sent");
    } catch {
      setError("Network error. Please try again.");
      setEmailStatus("idle");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCodeStatus("checking");
    try {
      const res = await fetch("/api/login/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Invalid code.");
        setCodeStatus("idle");
        return;
      }
      const next = params.get("next") || "/";
      router.push(next);
    } catch {
      setError("Network error. Please try again.");
      setCodeStatus("idle");
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 0",
    fontSize: "13px",
    fontWeight: 600,
    border: "none",
    borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
    background: "transparent",
    color: active ? "#2563eb" : "#6b7280",
    cursor: "pointer",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "white",
          padding: "36px 32px",
          borderRadius: "16px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/acb-logo.png"
          alt="Age Care Bathrooms"
          style={{ width: "80px", height: "auto", margin: "0 auto 4px" }}
        />
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0 }}>
          ACB Stats Portal
        </h1>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
          <button type="button" onClick={() => switchTab("authenticator")} style={tabStyle(tab === "authenticator")}>
            Authenticator
          </button>
          <button type="button" onClick={() => switchTab("email")} style={tabStyle(tab === "email")}>
            Email link
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Authenticator tab ── */}
        {tab === "authenticator" && (
          <form onSubmit={verifyCode} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
              Enter the 6-digit code from your Google&nbsp;Authenticator app.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000 000"
              autoFocus
              required
              autoComplete="one-time-code"
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: "24px",
                fontWeight: 600,
                letterSpacing: "0.3em",
                textAlign: "center",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                outline: "none",
                background: "white",
                color: "#111827",
                boxSizing: "border-box",
              }}
            />
            <button
              type="submit"
              disabled={codeStatus === "checking" || code.length !== 6}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "16px",
                fontWeight: 600,
                color: "white",
                background: codeStatus === "checking" || code.length !== 6 ? "#9ca3af" : "#2563eb",
                border: "none",
                borderRadius: "10px",
                cursor: codeStatus === "checking" || code.length !== 6 ? "not-allowed" : "pointer",
              }}
            >
              {codeStatus === "checking" ? "Verifying\u2026" : "Sign in"}
            </button>
          </form>
        )}

        {/* ── Email tab ── */}
        {tab === "email" && emailStatus === "sent" ? (
          <>
            <div
              style={{
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                borderRadius: "12px",
                padding: "16px",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              <strong>Check your inbox.</strong>
              <br />
              A sign-in link has been sent to <strong>{email}</strong>. Click
              it within 15 minutes to access the dashboard.
            </div>
            <button
              type="button"
              onClick={() => {
                setEmailStatus("idle");
                setError(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#2563eb",
                fontSize: "13px",
                cursor: "pointer",
                marginTop: "4px",
              }}
            >
              Use a different email
            </button>
          </>
        ) : tab === "email" ? (
          <form onSubmit={requestLink} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
              Enter your <strong>@agecare-bathrooms.co.uk</strong> email
              address and we&rsquo;ll send you a one-time sign-in link.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agecare-bathrooms.co.uk"
              autoFocus
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: "16px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                outline: "none",
                background: "white",
                color: "#111827",
                boxSizing: "border-box",
              }}
            />
            <button
              type="submit"
              disabled={emailStatus === "sending" || !email}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "16px",
                fontWeight: 600,
                color: "white",
                background: emailStatus === "sending" || !email ? "#9ca3af" : "#2563eb",
                border: "none",
                borderRadius: "10px",
                cursor: emailStatus === "sending" || !email ? "not-allowed" : "pointer",
              }}
            >
              {emailStatus === "sending" ? "Sending\u2026" : "Email me a sign-in link"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
