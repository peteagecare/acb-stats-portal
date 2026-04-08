"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Incorrect password");
        setLoading(false);
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
    } catch {
      setError("Login failed. Please try again.");
      setLoading(false);
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
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "white",
          padding: "32px 28px",
          borderRadius: "16px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/acb-logo.png"
            alt="Age Care Bathrooms"
            style={{ width: "72px", height: "auto", margin: "0 auto 12px" }}
          />
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#111827", margin: 0 }}>
            ACB Stats Portal
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "6px" }}>
            Enter the access password to continue
          </p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          required
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: "16px",
            borderRadius: "10px",
            border: "1px solid #d1d5db",
            outline: "none",
            background: "white",
            color: "#111827",
          }}
        />
        {error && (
          <div style={{ fontSize: "14px", color: "#dc2626", textAlign: "center" }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            fontWeight: 600,
            color: "white",
            background: loading || !password ? "#9ca3af" : "#2563eb",
            border: "none",
            borderRadius: "10px",
            cursor: loading || !password ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
