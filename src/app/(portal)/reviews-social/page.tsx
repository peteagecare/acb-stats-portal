"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface ReviewPlatform {
  name: string;
  url: string;
  colour: string;
  total: number;
  rating: number;
  increase: number | null;
}

interface SocialPlatform {
  name: string;
  url: string;
  colour: string;
  total: number;
  auto: boolean;
  increase: number | null;
}

interface AdPlatform {
  name: string;
  colour: string;
  spend: number;
  clicks: number;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function fmt(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getDefaultRange() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmt(monthStart), to: fmt(now) };
}

const PLATFORM_LOGOS: Record<string, ReactNode> = {
  Trustpilot: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="#00B67A"
      />
    </svg>
  ),
  Google: (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  ),
  "Reviews.io": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="#5B2D8E"
      />
    </svg>
  ),
  Facebook: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
        fill="#1877F2"
      />
    </svg>
  ),
  YouTube: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
        fill="#FF0000"
      />
      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#fff" />
    </svg>
  ),
  Instagram: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ig-rs" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#ffd600" />
          <stop offset="50%" stopColor="#ff0069" />
          <stop offset="100%" stopColor="#d300c5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-rs)" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="5" stroke="url(#ig-rs)" strokeWidth="2" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-rs)" />
    </svg>
  ),
  Twitter: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        fill="#1D1D1F"
      />
    </svg>
  ),
  LinkedIn: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
        fill="#0A66C2"
      />
    </svg>
  ),
  TikTok: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.3 0 .59.05.86.13V9.01a6.32 6.32 0 00-.86-.06 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.77 1.52V6.84a4.84 4.84 0 01-1.01-.15z"
        fill="#1D1D1F"
      />
    </svg>
  ),
};

export default function ReviewsSocialPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const [reviews, setReviews] = useState<ReviewPlatform[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [social, setSocial] = useState<SocialPlatform[]>([]);
  const [socialTotal, setSocialTotal] = useState(0);
  const [adSpend, setAdSpend] = useState<AdPlatform[]>([]);
  const [adSpendTotal, setAdSpendTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Reviews + Social reload when date range changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const reviewsReq = fetch(`/api/reviews?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setReviews(data?.platforms ?? []);
        setReviewsTotal(data?.totalReviews ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setReviews([]);
          setReviewsTotal(0);
        }
      });

    const socialReq = fetch(`/api/social?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setSocial(data?.platforms ?? []);
        setSocialTotal(data?.totalFollowers ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setSocial([]);
          setSocialTotal(0);
        }
      });

    Promise.all([reviewsReq, socialReq]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // Ad-spend is date-agnostic — fetch once
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ad-spend")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setAdSpend(data?.platforms ?? []);
        setAdSpendTotal(data?.totalSpend ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setAdSpend([]);
          setAdSpendTotal(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const threeMonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);

  const ranges = [
    { label: "This Month", from: fmt(monthStart), to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)) },
    { label: "Last Month", from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
    { label: "Last 3 Months", from: fmt(threeMonthsStart), to: fmt(lastMonthEnd) },
  ];

  const hasReviews = reviews.length > 0 && reviews.some((r) => r.total > 0);
  const hasSocial = social.length > 0 && social.some((s) => s.total > 0);
  const hasAdSpend = adSpend.length > 0 && adSpendTotal > 0;

  const allItems = [
    ...reviews
      .filter((r) => r.total > 0)
      .map((r) => ({
        type: "review" as const,
        name: r.name,
        url: r.url,
        colour: r.colour,
        total: r.total,
        rating: r.rating,
        increase: r.increase,
      })),
    ...social
      .filter((s) => s.total > 0)
      .map((s) => ({
        type: "social" as const,
        name: s.name,
        url: s.url,
        colour: s.colour,
        total: s.total,
        rating: 0,
        increase: s.increase,
      })),
  ];

  const gridCols = Math.min(Math.max(allItems.length, 1), 6);

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Title + date range picker */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "var(--color-text-primary, #1D1D1F)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Reviews & Social
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #86868B)",
              margin: "4px 0 0",
            }}
          >
            Review-platform totals, social follower counts and ad-spend across channels.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              gap: "2px",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "8px",
              padding: "3px",
            }}
          >
            {ranges.map((r) => {
              const active = from === r.from && to === r.to;
              return (
                <button
                  key={r.label}
                  onClick={() => {
                    setFrom(r.from);
                    setTo(r.to);
                  }}
                  style={{
                    fontSize: "11px",
                    fontWeight: active ? 600 : 400,
                    color: active ? "white" : "#86868B",
                    background: active ? "var(--color-accent, #0071E3)" : "transparent",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s var(--ease-apple, ease)",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "var(--radius-pill, 999px)",
              padding: "6px 12px",
            }}
          >
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "12px", color: "#1D1D1F", outline: "none", fontFamily: "inherit" }}
            />
            <span style={{ color: "#AEAEB2", fontSize: "12px" }}>→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "12px", color: "#1D1D1F", outline: "none", fontFamily: "inherit" }}
            />
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "var(--bg-card, #fff)",
            borderRadius: "var(--radius-card, 18px)",
            boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
            padding: "14px 16px",
            borderLeft: "3px solid #F59E0B",
          }}
        >
          <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-secondary, #86868B)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Reviews
          </p>
          <p style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", margin: 0, lineHeight: 1 }}>
            {reviewsTotal.toLocaleString()}
          </p>
        </div>
        <div
          style={{
            background: "var(--bg-card, #fff)",
            borderRadius: "var(--radius-card, 18px)",
            boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
            padding: "14px 16px",
            borderLeft: "3px solid #8B5CF6",
          }}
        >
          <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-secondary, #86868B)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Followers
          </p>
          <p style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", margin: 0, lineHeight: 1 }}>
            {socialTotal.toLocaleString()}
          </p>
        </div>
        <div
          style={{
            background: "var(--bg-card, #fff)",
            borderRadius: "var(--radius-card, 18px)",
            boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
            padding: "14px 16px",
            borderLeft: "3px solid #0F172A",
          }}
        >
          <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-secondary, #86868B)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Ad Spend
          </p>
          <p style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", margin: 0, lineHeight: 1 }}>
            £{adSpendTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Reviews + Social platform grid */}
      <section style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", margin: 0 }}>
            Platforms
          </h2>
          <div style={{ display: "flex", gap: "12px" }}>
            {hasReviews && (
              <span style={{ fontSize: "11px", color: "#AEAEB2" }}>
                <strong style={{ color: "#1D1D1F" }}>{reviewsTotal.toLocaleString()}</strong> reviews
              </span>
            )}
            {hasSocial && (
              <span style={{ fontSize: "11px", color: "#AEAEB2" }}>
                <strong style={{ color: "#1D1D1F" }}>{socialTotal.toLocaleString()}</strong> followers
              </span>
            )}
          </div>
        </div>

        {loading && allItems.length === 0 && (
          <div
            style={{
              background: "var(--bg-card, #fff)",
              borderRadius: "var(--radius-card, 18px)",
              boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
              padding: "24px",
              textAlign: "center",
              color: "var(--color-text-secondary, #86868B)",
              fontSize: "12px",
            }}
          >
            Loading platforms…
          </div>
        )}

        {!loading && allItems.length === 0 && (
          <div
            style={{
              background: "var(--bg-card, #fff)",
              borderRadius: "var(--radius-card, 18px)",
              boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
              padding: "24px",
              textAlign: "center",
              color: "var(--color-text-secondary, #86868B)",
              fontSize: "12px",
            }}
          >
            No review or social data for this period.
          </div>
        )}

        {allItems.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: "10px" }}>
            {allItems.map((item) => (
              <a
                key={`${item.type}-${item.name}`}
                href={item.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  textDecoration: "none",
                  background: "var(--bg-card, #fff)",
                  borderRadius: "var(--radius-card, 18px)",
                  boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
                  padding: "18px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  textAlign: "center",
                  borderTop: `3px solid ${item.colour}`,
                  transition: "transform 0.2s var(--ease-apple, ease), box-shadow 0.2s var(--ease-apple, ease)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-card-hover, 0 6px 20px rgba(0,0,0,0.08))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "";
                  e.currentTarget.style.boxShadow = "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))";
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "#F5F5F7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {PLATFORM_LOGOS[item.name] ?? (
                    <span style={{ fontSize: "16px", fontWeight: 600, color: item.colour }}>{item.name[0]}</span>
                  )}
                </div>
                <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary, #86868B)" }}>{item.name}</span>
                <span style={{ fontSize: "22px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", lineHeight: 1 }}>
                  {item.total.toLocaleString()}
                </span>
                {item.rating > 0 ? (
                  <span style={{ fontSize: "10px", fontWeight: 500, color: "#F59E0B" }}>★ {item.rating}</span>
                ) : (
                  <span style={{ fontSize: "10px", color: "#AEAEB2" }}>
                    {item.type === "review" ? "reviews" : "followers"}
                  </span>
                )}
                {item.increase !== null && item.increase > 0 && (
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 500,
                      color: "#059669",
                      background: "#F0FDF4",
                      borderRadius: "6px",
                      padding: "2px 8px",
                    }}
                  >
                    +{item.increase.toLocaleString()}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Ad Spend */}
      {hasAdSpend && (
        <section>
          <h2 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", margin: "0 0 10px" }}>
            Ad Spend
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
            <div
              style={{
                background: "var(--bg-card, #fff)",
                borderRadius: "var(--radius-card, 18px)",
                boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
                padding: "14px 16px",
                borderLeft: "3px solid #0F172A",
              }}
            >
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-secondary, #86868B)", margin: "0 0 4px", textTransform: "uppercase" }}>
                Total Spend
              </p>
              <p style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", margin: 0, lineHeight: 1 }}>
                £{adSpendTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {adSpend
              .filter((p) => p.spend > 0)
              .map((p) => (
                <div
                  key={p.name}
                  style={{
                    background: "var(--bg-card, #fff)",
                    borderRadius: "var(--radius-card, 18px)",
                    boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
                    padding: "14px 16px",
                    borderLeft: `3px solid ${p.colour}`,
                  }}
                >
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-secondary, #86868B)", margin: "0 0 4px", textTransform: "uppercase" }}>
                    {p.name}
                  </p>
                  <p style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", margin: 0, lineHeight: 1 }}>
                    £{p.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {p.clicks > 0 && (
                    <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "4px 0 0" }}>
                      {p.clicks.toLocaleString()} clicks · £{(p.spend / p.clicks).toFixed(2)} CPC
                    </p>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
