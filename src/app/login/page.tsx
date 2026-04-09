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
    padding: "12px 0",
    fontSize: "14px",
    fontWeight: active ? 500 : 400,
    border: "none",
    borderBottom: active ? "2px solid #1D1D1F" : "2px solid transparent",
    background: "transparent",
    color: active ? "#1D1D1F" : "#AEAEB2",
    cursor: "pointer",
    transition: "all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "16px 18px",
    fontSize: "16px",
    borderRadius: "14px",
    border: "1px solid rgba(0,0,0,0.1)",
    outline: "none",
    background: "#FAFAFA",
    color: "#1D1D1F",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "16px",
    fontSize: "16px",
    fontWeight: 500,
    color: "white",
    background: disabled ? "#D2D2D7" : "#1D1D1F",
    border: "none",
    borderRadius: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "#F5F5F7",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "white",
          padding: "44px 36px",
          borderRadius: "22px",
          boxShadow: "0 4px 40px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.02)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/acb-logo.png"
          alt="Age Care Bathrooms"
          style={{ width: "72px", height: "auto", margin: "0 auto 0" }}
        />
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1D1D1F", margin: 0, letterSpacing: "-0.3px" }}>
          ACB Stats Portal
        </h1>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
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
              background: "#FFF2F2",
              color: "#DC2626",
              borderRadius: "14px",
              padding: "14px 16px",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* Authenticator tab */}
        {tab === "authenticator" && (
          <form onSubmit={verifyCode} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "14px", color: "#86868B", margin: 0, lineHeight: 1.6 }}>
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
                ...inputStyle,
                fontSize: "28px",
                fontWeight: 600,
                letterSpacing: "0.3em",
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            />
            <button
              type="submit"
              disabled={codeStatus === "checking" || code.length !== 6}
              style={buttonStyle(codeStatus === "checking" || code.length !== 6)}
            >
              {codeStatus === "checking" ? "Verifying\u2026" : "Sign in"}
            </button>
          </form>
        )}

        {/* Email tab */}
        {tab === "email" && emailStatus === "sent" ? (
          <>
            <div
              style={{
                background: "#F0FFF4",
                color: "#059669",
                borderRadius: "14px",
                padding: "18px",
                fontSize: "14px",
                lineHeight: 1.6,
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
                color: "#0071E3",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Use a different email
            </button>
          </>
        ) : tab === "email" ? (
          <form onSubmit={requestLink} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "14px", color: "#86868B", margin: 0, lineHeight: 1.6 }}>
              Enter your <strong style={{ color: "#1D1D1F" }}>@agecare-bathrooms.co.uk</strong> email
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
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={emailStatus === "sending" || !email}
              style={buttonStyle(emailStatus === "sending" || !email)}
            >
              {emailStatus === "sending" ? "Sending\u2026" : "Email me a sign-in link"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
