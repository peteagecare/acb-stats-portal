"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const initialError = params.get("error") === "invalid"
    ? "That sign-in link has expired or is invalid. Request a new one below."
    : null;

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/login/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not send sign-in link.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

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

        {status === "sent" ? (
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
                setStatus("idle");
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
        ) : (
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
            <button
              type="submit"
              disabled={status === "sending" || !email}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "16px",
                fontWeight: 600,
                color: "white",
                background: status === "sending" || !email ? "#9ca3af" : "#2563eb",
                border: "none",
                borderRadius: "10px",
                cursor: status === "sending" || !email ? "not-allowed" : "pointer",
              }}
            >
              {status === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
