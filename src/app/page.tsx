"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { PieChart, Pie, ResponsiveContainer, Tooltip, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

interface LeadSource {
  label: string;
  value: string;
  count: number;
}

interface Goals {
  leadGoalPerMonth: number | null;
  prospectsGoalPerMonth: number | null;
  visitsGoalPerMonth: number | null;
  contactsGoalPerMonth: number | null;
  siteVisitsGoalPerWeek: number | null;
  installsGoalPerMonth: number | null;
  ppcGoalPerMonth: number | null;
  seoGoalPerMonth: number | null;
  contentGoalPerMonth: number | null;
  otherGoalPerMonth: number | null;
  ppcPercentGoal: number | null;
  seoPercentGoal: number | null;
  contentPercentGoal: number | null;
  otherPercentGoal: number | null;
}

const DEFAULT_GOALS: Goals = {
  leadGoalPerMonth: null,
  prospectsGoalPerMonth: null,
  visitsGoalPerMonth: null,
  contactsGoalPerMonth: null,
  siteVisitsGoalPerWeek: null,
  installsGoalPerMonth: 32,
  ppcGoalPerMonth: null,
  seoGoalPerMonth: null,
  contentGoalPerMonth: null,
  otherGoalPerMonth: null,
  ppcPercentGoal: null,
  seoPercentGoal: null,
  contentPercentGoal: null,
  otherPercentGoal: null,
};

async function loadGoalsFromServer(): Promise<Goals> {
  try {
    const res = await fetch("/api/goals");
    if (res.ok) return { ...DEFAULT_GOALS, ...(await res.json()) };
  } catch {}
  return DEFAULT_GOALS;
}

async function saveGoalsToServer(goals: Goals) {
  await fetch("/api/goals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goals),
  });
}

/* ── Constants ── */

const SOURCE_CATEGORIES: Record<string, string> = {
  "Google Ads": "PPC",
  "Bing Ads": "PPC",
  "Facebook Ads": "PPC",
  "Organic Search": "SEO",
  "AI": "SEO",
  "Directory Referral": "SEO",
  "Organic Social": "Content",
  "Organic YouTube": "Content",
};

function getSourceCategory(value: string): string {
  return SOURCE_CATEGORIES[value] ?? "Other";
}

const PROSPECT_ACTIONS: Record<string, string> = {
  "Brochure Download Form": "Brochure Download",
  "Flipbook Form": "Flipbook Form",
  "VAT Exempt Checker": "VAT Exemption Checker",
  "Pricing Guide": "Pricing Guide",
  "Physical Brochure Request": "Physical Brochure Request",
  "Newsletter Sign Up": "Newsletter",
};

const LEAD_ACTIONS: Record<string, string> = {
  "Brochure - Call Me": "Brochure - Call Me",
  "Request A Callback Form": "Callback Form",
  "Contact Form": "Contact Form",
  "Free Home Design Form": "Home Design Form",
  "Phone Call": "Phone Call",
  "Walk In Bath Form": "Walk In Bath Form",
  "Direct Email": "Direct Email",
  "Brochure - Home Visit": "Brochure - Home Visit",
  "Pricing Guide Home Visit": "Pricing Guide Home Visit",
};

/* ── Settings Modal ── */

function parseGoalDraft(val: string): number | null {
  const n = val.trim() === "" ? null : parseInt(val, 10);
  return n !== null && !isNaN(n) && n > 0 ? n : null;
}

function SettingsModal({ onClose, initialGoals }: { onClose: () => void; initialGoals: Goals }) {
  const [draftLead, setDraftLead] = useState(initialGoals.leadGoalPerMonth !== null ? String(initialGoals.leadGoalPerMonth) : "");
  const [draftProspects, setDraftProspects] = useState(initialGoals.prospectsGoalPerMonth !== null ? String(initialGoals.prospectsGoalPerMonth) : "");
  const [draftVisitsMonth, setDraftVisitsMonth] = useState(initialGoals.visitsGoalPerMonth !== null ? String(initialGoals.visitsGoalPerMonth) : "");
  const [draftFbReviews, setDraftFbReviews] = useState("");
  const [draftLinkedInSam, setDraftLinkedInSam] = useState("");
  const [draftGoogleSpend, setDraftGoogleSpend] = useState("");
  const [draftGoogleClicks, setDraftGoogleClicks] = useState("");
  const [draftMetaSpend, setDraftMetaSpend] = useState("");
  const [draftMetaClicks, setDraftMetaClicks] = useState("");
  const [draftBingSpend, setDraftBingSpend] = useState("");
  const [draftBingClicks, setDraftBingClicks] = useState("");
  useEffect(() => {
    fetch("/api/reviews").then((r) => r.ok ? r.json() : null).then((data) => {
      const fb = data?.platforms?.find((p: { name: string }) => p.name === "Facebook");
      if (fb?.total) setDraftFbReviews(String(fb.total));
    }).catch(() => {});
    fetch("/api/social").then((r) => r.ok ? r.json() : null).then((data) => {
      const sam = data?.platforms?.find((p: { name: string }) => p.name === "LinkedIn (Sam)");
      if (sam?.total) setDraftLinkedInSam(String(sam.total));
    }).catch(() => {});
    fetch("/api/ad-spend").then((r) => r.ok ? r.json() : null).then((data) => {
      if (data?.platforms) {
        for (const p of data.platforms) {
          if (p.name === "Google Ads") { setDraftGoogleSpend(String(p.spend || "")); setDraftGoogleClicks(String(p.clicks || "")); }
          if (p.name === "Meta Ads") { setDraftMetaSpend(String(p.spend || "")); setDraftMetaClicks(String(p.clicks || "")); }
          if (p.name === "Bing Ads") { setDraftBingSpend(String(p.spend || "")); setDraftBingClicks(String(p.clicks || "")); }
        }
      }
    }).catch(() => {});
  }, []);
  const [draftContacts, setDraftContacts] = useState(initialGoals.contactsGoalPerMonth !== null ? String(initialGoals.contactsGoalPerMonth) : "");
  const [draftSiteVisitsWeek, setDraftSiteVisitsWeek] = useState(initialGoals.siteVisitsGoalPerWeek !== null ? String(initialGoals.siteVisitsGoalPerWeek) : "");
  const [draftInstallsMonth, setDraftInstallsMonth] = useState(initialGoals.installsGoalPerMonth !== null ? String(initialGoals.installsGoalPerMonth) : "");
  const [draftPpcNum, setDraftPpcNum] = useState(initialGoals.ppcGoalPerMonth !== null ? String(initialGoals.ppcGoalPerMonth) : "");
  const [draftSeoNum, setDraftSeoNum] = useState(initialGoals.seoGoalPerMonth !== null ? String(initialGoals.seoGoalPerMonth) : "");
  const [draftContentNum, setDraftContentNum] = useState(initialGoals.contentGoalPerMonth !== null ? String(initialGoals.contentGoalPerMonth) : "");
  const [draftOtherNum, setDraftOtherNum] = useState(initialGoals.otherGoalPerMonth !== null ? String(initialGoals.otherGoalPerMonth) : "");
  const [draftPpc, setDraftPpc] = useState(initialGoals.ppcPercentGoal !== null ? String(initialGoals.ppcPercentGoal) : "");
  const [draftSeo, setDraftSeo] = useState(initialGoals.seoPercentGoal !== null ? String(initialGoals.seoPercentGoal) : "");
  const [draftContent, setDraftContent] = useState(initialGoals.contentPercentGoal !== null ? String(initialGoals.contentPercentGoal) : "");
  const [draftOther, setDraftOther] = useState(initialGoals.otherPercentGoal !== null ? String(initialGoals.otherPercentGoal) : "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updated: Goals = {
      leadGoalPerMonth: parseGoalDraft(draftLead),
      prospectsGoalPerMonth: parseGoalDraft(draftProspects),
      visitsGoalPerMonth: parseGoalDraft(draftVisitsMonth),
      contactsGoalPerMonth: parseGoalDraft(draftContacts),
      siteVisitsGoalPerWeek: parseGoalDraft(draftSiteVisitsWeek),
      installsGoalPerMonth: parseGoalDraft(draftInstallsMonth),
      ppcGoalPerMonth: parseGoalDraft(draftPpcNum),
      seoGoalPerMonth: parseGoalDraft(draftSeoNum),
      contentGoalPerMonth: parseGoalDraft(draftContentNum),
      otherGoalPerMonth: parseGoalDraft(draftOtherNum),
      ppcPercentGoal: parseGoalDraft(draftPpc),
      seoPercentGoal: parseGoalDraft(draftSeo),
      contentPercentGoal: parseGoalDraft(draftContent),
      otherPercentGoal: parseGoalDraft(draftOther),
    };
    await saveGoalsToServer(updated);
    // Update manual values
    const fbCount = parseGoalDraft(draftFbReviews);
    if (fbCount !== null && fbCount >= 0) {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Facebook", current: fbCount }),
      });
    }
    const samCount = parseGoalDraft(draftLinkedInSam);
    if (samCount !== null && samCount >= 0) {
      await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "LinkedIn (Sam)", current: samCount }),
      });
    }
    // Save ad spend
    const adSpendUpdates = [
      { name: "Google Ads", spend: parseFloat(draftGoogleSpend) || 0, clicks: parseInt(draftGoogleClicks) || 0 },
      { name: "Meta Ads", spend: parseFloat(draftMetaSpend) || 0, clicks: parseInt(draftMetaClicks) || 0 },
      { name: "Bing Ads", spend: parseFloat(draftBingSpend) || 0, clicks: parseInt(draftBingClicks) || 0 },
    ];
    for (const u of adSpendUpdates) {
      await fetch("/api/ad-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(u),
      });
    }
    setSaving(false);
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      />
      <div
        className="dashboard-modal-card"
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "440px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #F1F5F9",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Goals
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              color: "#64748B",
              fontSize: "16px",
              lineHeight: 1,
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* LEAD GOAL — hero style */}
          <div style={{ background: "#EFF6FF", borderRadius: "12px", padding: "20px", border: "2px solid #3B82F6" }}>
            <label
              htmlFor="leadGoal"
              style={{ display: "block", fontSize: "15px", fontWeight: 700, color: "#1D4ED8", marginBottom: "4px" }}
            >
              Lead Goal Per Month
            </label>
            <p style={{ fontSize: "12px", color: "#64748B", margin: "0 0 12px" }}>
              Your primary KPI. How many leads should we generate each month?
            </p>
            <input
              id="leadGoal"
              type="number"
              min="1"
              placeholder="e.g. 150"
              value={draftLead}
              onChange={(e) => setDraftLead(e.target.value)}
              style={{
                width: "100%",
                border: "2px solid #3B82F6",
                borderRadius: "10px",
                padding: "12px 14px",
                fontSize: "18px",
                fontWeight: 700,
                color: "#1D4ED8",
                boxSizing: "border-box",
                background: "white",
              }}
            />
          </div>

          {/* Prospects + Visits side by side */}
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="prospectsGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#B45309", marginBottom: "4px" }}>
                Prospects / Month
              </label>
              <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0 0 8px" }}>
                Target prospect actions
              </p>
              <input
                id="prospectsGoal"
                type="number"
                min="1"
                placeholder="e.g. 120"
                value={draftProspects}
                onChange={(e) => setDraftProspects(e.target.value)}
                style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="visitsMonthGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#047857", marginBottom: "4px" }}>
                Home Visits / Month
              </label>
              <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0 0 8px" }}>
                Target visits booked
              </p>
              <input
                id="visitsMonthGoal"
                type="number"
                min="1"
                placeholder="e.g. 20"
                value={draftVisitsMonth}
                onChange={(e) => setDraftVisitsMonth(e.target.value)}
                style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }}
              />
            </div>
          </div>

          <p style={{ fontSize: "11px", color: "#94A3B8", margin: "-8px 0 0", textAlign: "center" }}>
            All goals auto-adjust to your selected date range
          </p>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          {/* Contacts goal */}
          <div>
            <label htmlFor="contactsGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#6366F1", marginBottom: "4px" }}>
              Contacts / Month (overall)
            </label>
            <input id="contactsGoal" type="number" min="1" placeholder="e.g. 800" value={draftContacts} onChange={(e) => setDraftContacts(e.target.value)}
              style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
          </div>

          {/* Site visits per week goal */}
          <div>
            <label htmlFor="siteVisitsWeekGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3B82F6", marginBottom: "4px" }}>
              Site Visits / Week
            </label>
            <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0 0 8px" }}>
              Shown as a goal circle on each upcoming-week card
            </p>
            <input
              id="siteVisitsWeekGoal"
              type="number"
              min="1"
              placeholder="e.g. 60"
              value={draftSiteVisitsWeek}
              onChange={(e) => setDraftSiteVisitsWeek(e.target.value)}
              style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }}
            />
          </div>

          {/* Installs per month goal */}
          <div>
            <label htmlFor="installsMonthGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#7C3AED", marginBottom: "4px" }}>
              Installs / Month
            </label>
            <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0 0 8px" }}>
              Shown as a goal circle on each install month card
            </p>
            <input
              id="installsMonthGoal"
              type="number"
              min="1"
              placeholder="e.g. 32"
              value={draftInstallsMonth}
              onChange={(e) => setDraftInstallsMonth(e.target.value)}
              style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }}
            />
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          {/* Manual overrides */}
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "6px" }}>
              Manual Updates
            </p>
            <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0 0 12px" }}>
              These can{"'"}t be fetched automatically — update when they change.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="fbReviews" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#1877F2", marginBottom: "4px" }}>Facebook Reviews</label>
                <input id="fbReviews" type="number" min="0" placeholder="e.g. 3" value={draftFbReviews} onChange={(e) => setDraftFbReviews(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="liSam" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#0A66C2", marginBottom: "4px" }}>LinkedIn (Sam) Followers</label>
                <input id="liSam" type="number" min="0" placeholder="e.g. 500" value={draftLinkedInSam} onChange={(e) => setDraftLinkedInSam(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          {/* Ad Spend */}
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "6px" }}>
              Ad Spend (for selected period)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Google Ads", colour: "#4285F4", spend: draftGoogleSpend, setSpend: setDraftGoogleSpend, clicks: draftGoogleClicks, setClicks: setDraftGoogleClicks },
                { label: "Meta Ads", colour: "#1877F2", spend: draftMetaSpend, setSpend: setDraftMetaSpend, clicks: draftMetaClicks, setClicks: setDraftMetaClicks },
                { label: "Bing Ads", colour: "#00809D", spend: draftBingSpend, setSpend: setDraftBingSpend, clicks: draftBingClicks, setClicks: setDraftBingClicks },
              ].map((ad) => (
                <div key={ad.label} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: ad.colour, minWidth: "80px" }}>{ad.label}</span>
                  <div style={{ flex: 1 }}>
                    <input type="number" min="0" step="0.01" placeholder="£ spend" value={ad.spend} onChange={(e) => ad.setSpend(e.target.value)}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="number" min="0" placeholder="clicks" value={ad.clicks} onChange={(e) => ad.setClicks(e.target.value)}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "6px" }}>
              Source Channel Goals (%)
            </p>
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 12px" }}>
              Target percentage of leads + prospects from each channel.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="ppcGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#EF4444", marginBottom: "4px" }}>PPC %</label>
                <input id="ppcGoal" type="number" min="0" max="100" placeholder="e.g. 60" value={draftPpc} onChange={(e) => setDraftPpc(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="seoGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#10B981", marginBottom: "4px" }}>SEO %</label>
                <input id="seoGoal" type="number" min="0" max="100" placeholder="e.g. 25" value={draftSeo} onChange={(e) => setDraftSeo(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="contentGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#8B5CF6", marginBottom: "4px" }}>Content %</label>
                <input id="contentGoal" type="number" min="0" max="100" placeholder="e.g. 15" value={draftContent} onChange={(e) => setDraftContent(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="otherGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", marginBottom: "4px" }}>Other %</label>
                <input id="otherGoal" type="number" min="0" max="100" placeholder="e.g. 15" value={draftOther} onChange={(e) => setDraftOther(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
            </div>
            {(() => {
              const total = (parseGoalDraft(draftPpc) ?? 0) + (parseGoalDraft(draftSeo) ?? 0) + (parseGoalDraft(draftContent) ?? 0) + (parseGoalDraft(draftOther) ?? 0);
              const contactsNum = parseGoalDraft(draftContacts);
              return (
                <>
                  {total > 0 && (
                    <p style={{ fontSize: "11px", color: total > 100 ? "#DC2626" : "#94A3B8", margin: "8px 0 0" }}>
                      Total: {total}% {total > 100 ? "(exceeds 100%)" : ""}
                    </p>
                  )}
                  {contactsNum && contactsNum > 0 && total > 0 && (
                    <p style={{ fontSize: "11px", color: "#64748B", margin: "6px 0 0" }}>
                      = PPC <strong>{Math.round(contactsNum * (parseGoalDraft(draftPpc) ?? 0) / 100)}</strong> / SEO <strong>{Math.round(contactsNum * (parseGoalDraft(draftSeo) ?? 0) / 100)}</strong> / Content <strong>{Math.round(contactsNum * (parseGoalDraft(draftContent) ?? 0) / 100)}</strong> / Other <strong>{Math.round(contactsNum * (parseGoalDraft(draftOther) ?? 0) / 100)}</strong> per month
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "16px 24px",
            borderTop: "1px solid #F1F5F9",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              background: "white",
              color: "#64748B",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 20px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "10px",
              border: "none",
              background: saving ? "#64748B" : "#0F172A",
              color: "white",
              cursor: "pointer",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function getDefaultDates() {
  const now = new Date();
  const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return { from, to };
}

/* ── Dashboard ── */

export default function Dashboard() {
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [autoFetchTrigger, setAutoFetchTrigger] = useState(0);

  function applyQuickRange(fromDate: string, toDate: string) {
    setFrom(fromDate);
    setTo(toDate);
    setAutoFetchTrigger((n) => n + 1);
  }
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [liveNow, setLiveNow] = useState<number | null>(null);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [conversionActions, setConversionActions] = useState<LeadSource[]>([]);
  const [homeVisits, setHomeVisits] = useState<number | null>(null);
  const [timelineData, setTimelineData] = useState<{ label: string; count: number }[]>([]);
  const [timelineGranularity, setTimelineGranularity] = useState<string>("day");
  const [lifecycleStages, setLifecycleStages] = useState<{ label: string; value: string; count: number }[]>([]);
  const [lifecyclePeriod, setLifecyclePeriod] = useState<{ label: string; value: string; count: number }[]>([]);
  const [organicLeads, setOrganicLeads] = useState<number>(0);
  const [wonJobs, setWonJobs] = useState<number | null>(null);
  const [wonValue, setWonValue] = useState<number | null>(null);
  const [wonBySource, setWonBySource] = useState<{ label: string; count: number; value: number }[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, { prospects: number; leads: number }>>({});
  const [reviews, setReviews] = useState<{ name: string; url: string; colour: string; total: number; rating: number; increase: number | null }[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [adSpend, setAdSpend] = useState<{ name: string; colour: string; spend: number; clicks: number }[]>([]);
  const [adSpendTotal, setAdSpendTotal] = useState(0);
  const [unattributed, setUnattributed] = useState<{ contactsWithoutSource: number; visitsWithoutSource: number }>({ contactsWithoutSource: 0, visitsWithoutSource: 0 });
  const [dowConversion, setDowConversion] = useState<{
    contacts: number[];
    withVisit: number[];
    bySource?: { value: string; label: string; contacts: number[]; withVisit: number[]; totalContacts: number }[];
    byAction?: { value: string; label: string; contacts: number[]; withVisit: number[]; totalContacts: number }[];
  } | null>(null);
  const [dowSegment, setDowSegment] = useState<string>("__all__");
  const [siteVisits, setSiteVisits] = useState<{
    inPeriod: number;
    cancelled: number;
    upcoming: {
      label: string;
      weekStart: string;
      weekEnd: string;
      count: number;
      cancelled: number;
      bySalesman: Record<string, number>;
    }[];
  } | null>(null);
  const [installs, setInstalls] = useState<{
    months: { key: string; label: string; monthName: string; year: number; count: number }[];
  } | null>(null);
  const [homeVisitBreakdown, setHomeVisitBreakdown] = useState<{
    total: number;
    byAction: { value: string; label: string; count: number }[];
    bySource: { value: string; label: string; count: number }[];
  } | null>(null);
  const [prospectToLead, setProspectToLead] = useState<{
    totalEverProspect: number;
    convertedToLead: number;
    rate: number | null;
  } | null>(null);
  const [funnelTiming, setFunnelTiming] = useState<{
    prospectToLead: { avgDays: number | null; sample: number };
    leadToVisit: { avgDays: number | null; sample: number };
    prospectToVisit: { avgDays: number | null; sample: number };
  } | null>(null);
  const [outreachFeedback, setOutreachFeedback] = useState<{
    total: number;
    feedback: {
      value: string;
      label: string;
      count: number;
      bySource: { value: string; label: string; count: number }[];
      byAction: { value: string; label: string; count: number }[];
    }[];
  } | null>(null);
  const [funnelBySource, setFunnelBySource] = useState<{
    sources: {
      value: string;
      label: string;
      contacts: number;
      prospects: number;
      formLeads: number;
      directBookings: number;
      homeVisits: number;
      wonJobs: number;
      prospectActions: { value: string; count: number }[];
      leadActions: { value: string; count: number }[];
    }[];
  } | null>(null);
  const [customerJourneys, setCustomerJourneys] = useState<{
    journeys: { path: string; steps: string[]; count: number }[];
    totalContacts: number;
    filters: { leadSources: string[]; conversionActions: string[]; forms: string[] };
    contactJourneys: { path: string; steps: string[]; leadSource: string; conversionAction: string; forms: string[] }[];
  } | null>(null);
  const [journeyFilterSource, setJourneyFilterSource] = useState<string | null>(null);
  const [journeyFilterAction, setJourneyFilterAction] = useState<string | null>(null);
  const [journeyFilterForm, setJourneyFilterForm] = useState<string | null>(null);
  const [journeyShowVisit, setJourneyShowVisit] = useState(10);
  const [journeyShowNoVisit, setJourneyShowNoVisit] = useState(10);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [aiDismissed, setAiDismissed] = useState<Set<number>>(new Set());
  const [aiRejectingIdx, setAiRejectingIdx] = useState<number | null>(null);
  const [aiRejectReason, setAiRejectReason] = useState("");
  const [aiRejected, setAiRejected] = useState<string[]>([]);
  const [aiAccepted, setAiAccepted] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);

  // Load rejected insights from server
  useEffect(() => {
    fetch("/api/ai-feedback").then((r) => r.ok ? r.json() : null).then((data) => {
      if (data?.rejected) setAiRejected(data.rejected);
      if (data?.accepted) setAiAccepted(data.accepted);
    }).catch(() => {});
  }, []);
  const [social, setSocial] = useState<{ name: string; url: string; colour: string; total: number; auto: boolean; increase: number | null }[]>([]);
  const [socialTotal, setSocialTotal] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<string>("contacts");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [dataReady, setDataReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const inlineFilterRef = useRef<HTMLDivElement>(null);
  const [stickyFilterVisible, setStickyFilterVisible] = useState(false);

  useEffect(() => {
    const el = inlineFilterRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyFilterVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [dataReady]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [previousPeriod, setPreviousPeriod] = useState<{
    contacts: number;
    prospects: number;
    leads: number;
    homeVisits: number;
    wonJobs: number;
    wonValue: number;
    from: string;
    to: string;
  } | null>(null);
  const [recentContacts, setRecentContacts] = useState<{ name: string; email: string; date: string; action: string; source: string; stage: string }[]>([]);
  const [pipelineCount, setPipelineCount] = useState<number>(0);
  const [timeToVisit, setTimeToVisit] = useState<{ averageDays: number; count: number } | null>(null);

  useEffect(() => {
    loadGoalsFromServer().then(setGoals);
  }, [showSettings]);

  // Realtime visitors — poll every 30s
  useEffect(() => {
    const fetchRealtime = () => {
      fetch("/api/ga/realtime")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.activeNow != null) setLiveNow(data.activeNow); })
        .catch(() => {});
    };
    fetchRealtime();
    const interval = setInterval(fetchRealtime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Reviews & Social — fetch on load
  useEffect(() => {
    fetch(`/api/reviews?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.platforms) setReviews(data.platforms);
        if (data?.totalReviews) setReviewsTotal(data.totalReviews);
      })
      .catch(() => {});
    fetch(`/api/social?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.platforms) setSocial(data.platforms);
        if (data?.totalFollowers) setSocialTotal(data.totalFollowers);
      })
      .catch(() => {});
    fetch("/api/ad-spend")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.platforms) setAdSpend(data.platforms);
        if (data?.totalSpend != null) setAdSpendTotal(data.totalSpend);
      })
      .catch(() => {});
    // Previous period comparison
    fetch(`/api/hubspot/previous-period?from=${from}&to=${to}`)
      .then((r) => {
        console.log("[previous-period] status:", r.status);
        return r.ok ? r.json() : r.text().then((t) => { console.error("[previous-period] error body:", t); return null; });
      })
      .then((data) => {
        if (data) {
          console.log("[previous-period] loaded:", data);
          setPreviousPeriod(data);
        } else {
          console.error("[previous-period] no data returned");
        }
      })
      .catch((e) => console.error("[previous-period] fetch failed:", e));
    // Time to visit
    fetch(`/api/hubspot/time-to-visit?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setTimeToVisit(data); })
      .catch(() => {});
  }, [from, to]);

  // Lifecycle stages — live count, not date-filtered
  useEffect(() => {
    fetch("/api/hubspot/lifecycle-stages")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.stages) setLifecycleStages(data.stages); })
      .catch(() => {});
    // Recent contacts
    fetch("/api/hubspot/recent-contacts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.contacts) setRecentContacts(data.contacts); })
      .catch(() => {});
    // Pipeline value
    fetch("/api/hubspot/pipeline-value")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.count != null) setPipelineCount(data.count); })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadProgress(5);
    setDataReady(false);
    try {
      const gaRes = await fetch(`/api/ga/active-users?from=${from}&to=${to}`);
      if (gaRes.ok) setActiveUsers((await gaRes.json()).activeUsers);
      setLoadProgress(15);

      // Batch 1: Core data
      const [sourcesRes, actionsRes, visitsRes] = await Promise.all([
        fetch(`/api/hubspot/lead-sources?from=${from}&to=${to}`),
        fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}`),
        fetch(`/api/hubspot/home-visits?from=${from}&to=${to}`),
      ]);
      if (sourcesRes.ok) setSources((await sourcesRes.json()).sources);
      if (actionsRes.ok) setConversionActions((await actionsRes.json()).actions);
      if (visitsRes.ok) setHomeVisits((await visitsRes.json()).total);
      setLoadProgress(40);

      // Batch 2: Won jobs + organic leads
      const [wonRes, organicRes] = await Promise.all([
        fetch(`/api/hubspot/won-deals?from=${from}&to=${to}`),
        fetch(`/api/hubspot/organic-leads?from=${from}&to=${to}`),
      ]);
      if (wonRes.ok) {
        const wonData = await wonRes.json();
        setWonJobs(wonData.total);
        setWonValue(wonData.totalValue);
        setWonBySource(wonData.bySource ?? []);
      }
      if (organicRes.ok) setOrganicLeads((await organicRes.json()).total);
      setLoadProgress(55);

      // Batch 3: Source breakdown
      const breakdownRes = await fetch(`/api/hubspot/source-breakdown?from=${from}&to=${to}`);
      if (breakdownRes.ok) setSourceBreakdown((await breakdownRes.json()).breakdown);
      setLoadProgress(70);

      // Batch 4: Lifecycle period
      const lcPeriodRes = await fetch(`/api/hubspot/lifecycle-stages-period?from=${from}&to=${to}`);
      if (lcPeriodRes.ok) setLifecyclePeriod((await lcPeriodRes.json()).stages);
      setLoadProgress(85);

      // Batch 5: Timeline + unattributed + day-of-week conversion
      setSelectedMetric("contacts");
      const [timelineRes, unattribRes, dowRes, siteVisitsRes, installsRes, hvBreakdownRes, funnelSourceRes, outreachRes, timingRes, p2lRes, journeysRes] = await Promise.all([
        fetch(`/api/hubspot/contacts-daily?from=${from}&to=${to}&metric=contacts`),
        fetch(`/api/hubspot/unattributed?from=${from}&to=${to}`),
        fetch(`/api/hubspot/dow-conversion?from=${from}&to=${to}`),
        fetch(`/api/hubspot/site-visits?from=${from}&to=${to}`),
        fetch(`/api/hubspot/installs`),
        fetch(`/api/hubspot/home-visit-breakdown?from=${from}&to=${to}`),
        fetch(`/api/hubspot/funnel-by-source?from=${from}&to=${to}`),
        fetch(`/api/hubspot/outreach-feedback?from=${from}&to=${to}`),
        fetch(`/api/hubspot/funnel-timing?from=${from}&to=${to}`),
        fetch(`/api/hubspot/prospect-to-lead?from=${from}&to=${to}`),
        fetch(`/api/hubspot/customer-journeys?from=${from}&to=${to}`),
      ]);
      if (unattribRes.ok) {
        setUnattributed(await unattribRes.json());
      } else {
        console.error("[unattributed] failed:", unattribRes.status, await unattribRes.text());
      }
      if (dowRes.ok) {
        setDowConversion(await dowRes.json());
      } else {
        console.error("[dow-conversion] failed:", dowRes.status, await dowRes.text());
        setDowConversion(null);
      }
      if (siteVisitsRes.ok) {
        setSiteVisits(await siteVisitsRes.json());
      } else {
        console.error("[site-visits] failed:", siteVisitsRes.status, await siteVisitsRes.text());
        setSiteVisits(null);
      }
      if (installsRes.ok) {
        setInstalls(await installsRes.json());
      } else {
        console.error("[installs] failed:", installsRes.status, await installsRes.text());
        setInstalls(null);
      }
      if (hvBreakdownRes.ok) {
        setHomeVisitBreakdown(await hvBreakdownRes.json());
      } else {
        console.error("[home-visit-breakdown] failed:", hvBreakdownRes.status, await hvBreakdownRes.text());
        setHomeVisitBreakdown(null);
      }
      if (funnelSourceRes.ok) {
        setFunnelBySource(await funnelSourceRes.json());
      } else {
        console.error("[funnel-by-source] failed:", funnelSourceRes.status, await funnelSourceRes.text());
        setFunnelBySource(null);
      }
      if (outreachRes.ok) {
        setOutreachFeedback(await outreachRes.json());
      } else {
        console.error("[outreach-feedback] failed:", outreachRes.status, await outreachRes.text());
        setOutreachFeedback(null);
      }
      if (timingRes.ok) {
        setFunnelTiming(await timingRes.json());
      } else {
        console.error("[funnel-timing] failed:", timingRes.status, await timingRes.text());
        setFunnelTiming(null);
      }
      if (p2lRes.ok) {
        setProspectToLead(await p2lRes.json());
      } else {
        console.error("[prospect-to-lead] failed:", p2lRes.status, await p2lRes.text());
        setProspectToLead(null);
      }
      if (timelineRes.ok) {
        const timelineJson = await timelineRes.json();
        setTimelineData(timelineJson.data);
        setTimelineGranularity(timelineJson.granularity);
      }
      if (journeysRes.ok) {
        setCustomerJourneys(await journeysRes.json());
        setJourneyFilterSource(null);
        setJourneyFilterAction(null);
        setJourneyFilterForm(null);
        setJourneyShowVisit(10);
        setJourneyShowNoVisit(10);
      } else {
        console.error("[customer-journeys] failed:", journeysRes.status, await journeysRes.text());
        setCustomerJourneys(null);
      }
      setLoadProgress(100);
      setDataReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setDataReady(true);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoFetchTrigger > 0) fetchData();
  }, [autoFetchTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMetric = useCallback(async (metric: string) => {
    if (metric === selectedMetric) return;
    setSelectedMetric(metric);
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/hubspot/contacts-daily?from=${from}&to=${to}&metric=${metric}`);
      if (res.ok) {
        const json = await res.json();
        setTimelineData(json.data);
        setTimelineGranularity(json.granularity);
      }
    } finally {
      setTimelineLoading(false);
    }
  }, [from, to, selectedMetric]);

  async function fetchAiInsights() {
    setAiLoading(true);
    try {
      const bestDay = timelineData.length > 0 ? timelineData.reduce((b, d) => d.count > b.count ? d : b, timelineData[0]) : null;
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitors: activeUsers,
          contacts: sourcesTotal,
          prospects: prospectsTotal,
          leads: leadsTotal,
          homeVisits: homeVisits ?? 0,
          wonJobs: wonJobs ?? 0,
          wonValue: wonValue ?? 0,
          unattributedContacts: unattributed.contactsWithoutSource,
          organicLeads,
          sources: sources.filter((s) => s.count > 0),
          prospectActions: conversionActions.filter((a) => a.value in PROSPECT_ACTIONS && a.count > 0),
          leadActions: conversionActions.filter((a) => a.value in LEAD_ACTIONS && a.count > 0),
          prevContacts: previousPeriod?.contacts,
          prevLeads: previousPeriod?.leads,
          bestDay: bestDay ? `${bestDay.count} contacts on ${bestDay.label}` : null,
          rejectedInsights: aiRejected,
          acceptedInsights: aiAccepted,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = (data.insights as string)
          .split(/\n/)
          .map((l: string) => l.replace(/^\d+\.\s*/, "").trim())
          .filter((l: string) => l.length > 10);
        setAiInsights(parsed);
        setAiDismissed(new Set());
        setAiOpen(true);
      }
    } catch {} finally {
      setAiLoading(false);
    }
  }

  async function sendAiChat() {
    if (!aiChatInput.trim()) return;
    const question = aiChatInput.trim();
    setAiChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setAiChatInput("");
    setAiChatLoading(true);
    try {
      const bestDay = timelineData.length > 0 ? timelineData.reduce((b, d) => d.count > b.count ? d : b, timelineData[0]) : null;
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          dashboardData: {
            visitors: activeUsers,
            contacts: sourcesTotal,
            prospects: prospectsTotal,
            leads: leadsTotal,
            homeVisits: homeVisits ?? 0,
            wonJobs: wonJobs ?? 0,
            wonValue: wonValue ?? 0,
            unattributedContacts: unattributed.contactsWithoutSource,
            organicLeads,
            sources: sources.filter((s) => s.count > 0),
            prevContacts: previousPeriod?.contacts,
            prevLeads: previousPeriod?.leads,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiChatMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
      }
    } catch {} finally {
      setAiChatLoading(false);
    }
  }

  function proratedGoal(monthlyGoal: number | null): number | null {
    if (!monthlyGoal || monthlyGoal <= 0) return null;
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59");
    const rangeDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return Math.max(1, Math.round((monthlyGoal / 30.44) * rangeDays));
  }

  const sourcesTotal = sources.reduce((sum, s) => sum + s.count, 0);
  const ppcSources = sources.filter((s) => getSourceCategory(s.value) === "PPC");
  const seoSources = sources.filter((s) => getSourceCategory(s.value) === "SEO");
  const contentSources = sources.filter((s) => getSourceCategory(s.value) === "Content");
  const otherSources = sources.filter((s) => getSourceCategory(s.value) === "Other");
  const ppcTotal = ppcSources.reduce((sum, s) => sum + s.count, 0);
  const seoTotal = seoSources.reduce((sum, s) => sum + s.count, 0);
  const contentTotal = contentSources.reduce((sum, s) => sum + s.count, 0);
  const otherTotal = otherSources.reduce((sum, s) => sum + s.count, 0);
  const prospects = conversionActions.filter(
    (a) => a.value in PROSPECT_ACTIONS && a.count > 0
  );
  const prospectsTotal = prospects.reduce((sum, a) => sum + a.count, 0);
  const leads = conversionActions.filter(
    (a) => a.value in LEAD_ACTIONS && a.count > 0
  );
  const formLeadsTotal = leads.reduce((sum, a) => sum + a.count, 0);
  const leadsTotal = formLeadsTotal + organicLeads;

  // ── Source filter slice ────────────────────────────────────────
  // When `selectedSource` is set, every Customer Funnel KPI/breakdown
  // value is sourced from the cohort view (contacts CREATED in this
  // period from this source). When null, the existing dashboard values
  // are used unchanged.
  const sourceSlice = selectedSource && funnelBySource
    ? funnelBySource.sources.find((s) => s.value === selectedSource) ?? null
    : null;
  const isSourceFiltered = !!sourceSlice;
  const dispContacts = sourceSlice ? sourceSlice.contacts : sourcesTotal;
  const dispProspects = sourceSlice ? sourceSlice.prospects : prospectsTotal;
  const dispFormLeads = sourceSlice ? sourceSlice.formLeads : formLeadsTotal;
  const dispDirectBookings = sourceSlice ? sourceSlice.directBookings : organicLeads;
  const dispLeads = sourceSlice ? sourceSlice.formLeads + sourceSlice.directBookings : leadsTotal;
  const dispHomeVisits = sourceSlice ? sourceSlice.homeVisits : (homeVisits ?? 0);
  const dispWonJobs = sourceSlice ? sourceSlice.wonJobs : (wonJobs ?? 0);


  const categoryCards: { title: string; total: number; sources: LeadSource[]; colour: string; bg: string; icon: string }[] = [
    { title: "PPC", total: ppcTotal, sources: ppcSources, colour: "#EF4444", bg: "#FEF2F2", icon: "Paid ads" },
    { title: "SEO", total: seoTotal, sources: seoSources, colour: "#10B981", bg: "#ECFDF5", icon: "Organic search" },
    { title: "Content", total: contentTotal, sources: contentSources, colour: "#8B5CF6", bg: "#F5F3FF", icon: "Social & video" },
    { title: "Other", total: otherTotal, sources: otherSources, colour: "#64748B", bg: "#F8FAFC", icon: "Direct & misc" },
  ];

  return (
    <div className="dashboard-root" style={{ minHeight: "100vh", background: "#F1F5F9" }}>
      {/* Header */}
      <header style={{ background: "#0F172A", padding: "0 16px" }}>
        <div
          className="dashboard-header-bar"
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "48px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/acb-logo.png" alt="ACB" style={{ height: "28px", objectFit: "contain" }} />
            <div>
              <h1 style={{ fontSize: "13px", fontWeight: 700, margin: 0, color: "white", letterSpacing: "-0.3px" }}>
                ACB Stats
              </h1>
              <p style={{ fontSize: "10px", margin: 0, color: "#64748B" }}>Marketing Funnel</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Quick date range links */}
            {(() => {
              const today = new Date();
              const pad = (n: number) => n.toString().padStart(2, "0");
              const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
              const todayStr = fmt(today);

              // Start of this week (Monday)
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));

              // Start of this month
              const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

              // Last month
              const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

              // Last 3 months
              const threeMonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);

              const ranges = [
                { label: "Today", from: todayStr, to: todayStr },
                { label: "This Week", from: fmt(weekStart), to: fmt((() => { const sun = new Date(weekStart); sun.setDate(sun.getDate() + 6); return sun; })()) },
                { label: "This Month", from: fmt(monthStart), to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)) },
                { label: "Last Month", from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
                { label: "Last 3 Months", from: fmt(threeMonthsStart), to: fmt(lastMonthEnd) },
              ];

              return (
                <div className="dashboard-quick-ranges" style={{ display: "flex", gap: "2px", background: "#1E293B", borderRadius: "8px", padding: "3px" }}>
                  {ranges.map((r) => {
                    const active = from === r.from && to === r.to;
                    return (
                      <button
                        key={r.label}
                        onClick={() => applyQuickRange(r.from, r.to)}
                        style={{
                          fontSize: "11px",
                          fontWeight: active ? 700 : 500,
                          color: active ? "white" : "#94A3B8",
                          background: active ? "#3B82F6" : "transparent",
                          border: "none",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          transition: "all 0.15s",
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            {/* Date range inline in header */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1E293B", borderRadius: "10px", padding: "6px 12px" }}>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
              <span style={{ color: "#475569", fontSize: "12px" }}>&mdash;</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                background: loading ? "#334155" : "#3B82F6",
                color: "white",
                fontWeight: 600,
                borderRadius: "10px",
                padding: "8px 18px",
                fontSize: "13px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {loading ? "..." : "Go"}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              style={{
                background: "#1E293B",
                border: "none",
                borderRadius: "10px",
                padding: "8px",
                cursor: "pointer",
                color: "#94A3B8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16.17 12.5a1.39 1.39 0 00.28 1.53l.05.05a1.69 1.69 0 11-2.38 2.38l-.05-.05a1.39 1.39 0 00-1.53-.28 1.39 1.39 0 00-.84 1.27v.15a1.69 1.69 0 11-3.38 0v-.08a1.39 1.39 0 00-.91-1.27 1.39 1.39 0 00-1.53.28l-.05.05a1.69 1.69 0 11-2.38-2.38l.05-.05a1.39 1.39 0 00.28-1.53 1.39 1.39 0 00-1.27-.84h-.15a1.69 1.69 0 110-3.38h.08a1.39 1.39 0 001.27-.91 1.39 1.39 0 00-.28-1.53l-.05-.05a1.69 1.69 0 112.38-2.38l.05.05a1.39 1.39 0 001.53.28h.07a1.39 1.39 0 00.84-1.27v-.15a1.69 1.69 0 113.38 0v.08a1.39 1.39 0 00.84 1.27 1.39 1.39 0 001.53-.28l.05-.05a1.69 1.69 0 112.38 2.38l-.05.05a1.39 1.39 0 00-.28 1.53v.07a1.39 1.39 0 001.27.84h.15a1.69 1.69 0 110 3.38h-.08a1.39 1.39 0 00-1.27.84z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Sticky source filter bar — only shows after scrolling past the inline one */}
      {stickyFilterVisible && funnelBySource && funnelBySource.sources.length > 0 && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: isSourceFiltered ? "#1E293B" : "#F8FAFC",
            borderBottom: isSourceFiltered ? "2px solid #2563eb" : "1px solid #E2E8F0",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "10px", fontWeight: 700, color: isSourceFiltered ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "4px" }}>
            Source
          </span>
          <button
            type="button"
            onClick={() => setSelectedSource(null)}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 700,
              border: !isSourceFiltered ? "1px solid #0F172A" : "1px solid #475569",
              background: !isSourceFiltered ? "#0F172A" : "transparent",
              color: !isSourceFiltered ? "white" : "#94A3B8",
              borderRadius: "999px",
              cursor: "pointer",
            }}
          >
            All
          </button>
          {funnelBySource.sources.filter((s) => s.contacts > 0).map((s) => {
            const active = selectedSource === s.value;
            return (
              <button
                type="button"
                key={s.value}
                onClick={() => setSelectedSource(active ? null : s.value)}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: active ? "1px solid #2563eb" : `1px solid ${isSourceFiltered ? "#475569" : "#E2E8F0"}`,
                  background: active ? "#2563eb" : "transparent",
                  color: active ? "white" : isSourceFiltered ? "#94A3B8" : "#475569",
                  borderRadius: "999px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label} <span style={{ opacity: 0.7 }}>{s.contacts}</span>
              </button>
            );
          })}
          {isSourceFiltered && sourceSlice && (
            <span style={{ fontSize: "10px", color: "#64748B", marginLeft: "auto" }}>
              Cohort view · {sourceSlice.contacts} contacts
            </span>
          )}
        </div>
      )}
      <main className="dashboard-main" style={{ maxWidth: "1600px", margin: "0 auto", padding: "16px" }}>
        {/* Error */}
        {error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "20px",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* Full-screen loader — hides everything until data is ready */}
        {!dataReady && (() => {
          const size = 220;
          const centre = size / 2;
          const radius = 100;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (loadProgress / 100) * circumference;
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "white",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "24px",
              }}
            >
              {/* Circular progress ring with logo inside */}
              <div style={{ position: "relative", width: `${size}px`, height: `${size}px` }}>
                <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
                  <circle cx={centre} cy={centre} r={radius} fill="none" stroke="#F1F5F9" strokeWidth="4" />
                  <circle
                    cx={centre} cy={centre} r={radius} fill="none"
                    stroke="#3B82F6"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.4s ease" }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src="/acb-logo.png" alt="Age Care Bathrooms" style={{ height: "70px", objectFit: "contain" }} />
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: "0 0 4px" }}>
                  {loadProgress}%
                </p>
                <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>
                  {loadProgress < 15 ? "Connecting..." : loadProgress < 55 ? "Loading contacts..." : loadProgress < 85 ? "Analysing sources..." : "Almost there..."}
                </p>
              </div>
            </div>
          );
        })()}

        {dataReady && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* === THE CUSTOMER FUNNEL === */}
            {/* Source filter pills */}
            {funnelBySource && funnelBySource.sources.length > 0 && (
              <div ref={inlineFilterRef} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "4px" }}>
                  Filter by source
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSource(null)}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: selectedSource === null ? "1px solid #0F172A" : "1px solid #E2E8F0",
                    background: selectedSource === null ? "#0F172A" : "white",
                    color: selectedSource === null ? "white" : "#475569",
                    borderRadius: "999px",
                    cursor: "pointer",
                  }}
                >
                  All
                </button>
                {funnelBySource.sources.filter((s) => s.contacts > 0).map((s) => {
                  const active = selectedSource === s.value;
                  return (
                    <button
                      type="button"
                      key={s.value}
                      onClick={() => setSelectedSource(active ? null : s.value)}
                      style={{
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: active ? "1px solid #2563eb" : "1px solid #E2E8F0",
                        background: active ? "#2563eb" : "white",
                        color: active ? "white" : "#475569",
                        borderRadius: "999px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.label} <span style={{ opacity: 0.7, marginLeft: "4px" }}>{s.contacts}</span>
                    </button>
                  );
                })}
                {selectedSource && (
                  <span style={{ fontSize: "11px", color: "#94A3B8", marginLeft: "auto", fontStyle: "italic" }}>
                    Cohort view: contacts created in this period from this source
                  </span>
                )}
              </div>
            )}
            {/* === GOALS SUMMARY === */}
            <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Goals
                </h2>
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                  Targets adjust to your selected date range
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: "12px" }}>
                {[
                  { label: "Contacts", current: dispContacts, goal: proratedGoal(goals.contactsGoalPerMonth), colour: "#6366F1" },
                  { label: "Prospects", current: dispProspects, goal: proratedGoal(goals.prospectsGoalPerMonth), colour: "#F59E0B" },
                  { label: "Leads", current: dispLeads, goal: proratedGoal(goals.leadGoalPerMonth), colour: "#3B82F6" },
                  { label: "Home Visits", current: dispHomeVisits, goal: proratedGoal(goals.visitsGoalPerMonth), colour: "#10B981" },
                ].map((g) => {
                  if (!g.goal || g.goal <= 0) return null;
                  const pct = Math.min((g.current / g.goal) * 100, 100);
                  const met = g.current >= g.goal;
                  const size = 110;
                  const strokeWidth = 7;
                  const radius = (size - strokeWidth) / 2;
                  const circumference = 2 * Math.PI * radius;
                  const offset = circumference - (pct / 100) * circumference;
                  return (
                    <div key={g.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      <div style={{ position: "relative", width: size, height: size }}>
                        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
                          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                            stroke={met ? "#10B981" : g.colour}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            style={{ transition: "stroke-dashoffset 0.6s ease" }}
                          />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "22px", fontWeight: 800, color: met ? "#059669" : "#0F172A", lineHeight: 1 }}>{g.current}</span>
                          <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500 }}>/ {g.goal}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: met ? "#059669" : "#334155" }}>{g.label}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: met ? "#059669" : g.colour }}>{met ? "Goal met" : `${pct.toFixed(0)}%`}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                The Customer Funnel
              </h2>
              {unattributed.contactsWithoutSource > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "8px", padding: "4px 12px" }}>
                  <span style={{ fontSize: "11px", color: "#92400E", fontWeight: 600 }}>
                    {unattributed.contactsWithoutSource} contact{unattributed.contactsWithoutSource !== 1 ? "s" : ""} without a source
                    {unattributed.visitsWithoutSource > 0 && ` (${unattributed.visitsWithoutSource} with visits booked)`}
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px" }}>
              <KpiCard label="Website Visitors" value={isSourceFiltered ? null : activeUsers} colour="#8B5CF6" liveNow={isSourceFiltered ? null : liveNow} subtitle={isSourceFiltered ? "n/a when filtered" : undefined} />
              <KpiCard label="Contacts" value={dispContacts} colour="#6366F1" comparison={!isSourceFiltered && previousPeriod ? { current: sourcesTotal, previous: previousPeriod.contacts } : undefined} />
              <KpiCard label="Prospects" value={dispProspects} colour="#F59E0B" comparison={!isSourceFiltered && previousPeriod ? { current: prospectsTotal, previous: previousPeriod.prospects } : undefined} goal={!isSourceFiltered && proratedGoal(goals.prospectsGoalPerMonth) ? { current: prospectsTotal, target: proratedGoal(goals.prospectsGoalPerMonth)! } : undefined} />
              <KpiCard label="Leads" value={dispLeads} colour="#3B82F6" comparison={!isSourceFiltered && previousPeriod ? { current: leadsTotal, previous: previousPeriod.leads } : undefined} detail={dispDirectBookings > 0 ? `${dispFormLeads} Form Leads + ${dispDirectBookings} Direct Bookings` : undefined} goal={!isSourceFiltered && proratedGoal(goals.leadGoalPerMonth) ? { current: leadsTotal, target: proratedGoal(goals.leadGoalPerMonth)! } : undefined} />
              <KpiCard label="Home Visits" value={dispHomeVisits} colour="#10B981" subtitle={siteVisits && siteVisits.cancelled > 0 ? `${siteVisits.cancelled} cancelled` : undefined} comparison={!isSourceFiltered && previousPeriod ? { current: homeVisits ?? 0, previous: previousPeriod.homeVisits } : undefined} goal={!isSourceFiltered && proratedGoal(goals.visitsGoalPerMonth) ? { current: homeVisits ?? 0, target: proratedGoal(goals.visitsGoalPerMonth)! } : undefined} />
              <KpiCard label="Won Jobs" value={dispWonJobs} colour="#059669" subtitle={!isSourceFiltered && wonValue ? `£${wonValue.toLocaleString()} value` : undefined} comparison={!isSourceFiltered && previousPeriod ? { current: wonJobs ?? 0, previous: previousPeriod.wonJobs } : undefined} />
            </div>
            </div>


            <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Funnel Breakdown
                </h2>
                {!isSourceFiltered && previousPeriod && (
                  <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>
                    vs {(() => {
                      const fmt = (s: string) => {
                        const [, m, d] = s.split("-");
                        return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
                      };
                      return `${fmt(previousPeriod.from)}–${fmt(previousPeriod.to)}`;
                    })()}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {(() => {
                  // Compute prev rates only when not source-filtered (cohort math doesn't compare cleanly)
                  const showPrev = !isSourceFiltered && previousPeriod;
                  const pp = previousPeriod;
                  const prevContactRate = showPrev && pp && pp.contacts > 0 ? (pp.prospects / pp.contacts) * 100 : null;
                  const prevLeadRate = showPrev && pp && pp.contacts > 0 ? (pp.leads / pp.contacts) * 100 : null;
                  const prevVisitRate = showPrev && pp && pp.leads > 0 ? (pp.homeVisits / pp.leads) * 100 : null;
                  const prevWonRate = showPrev && pp && pp.homeVisits > 0 ? (pp.wonJobs / pp.homeVisits) * 100 : null;
                  return [
                    { label: "Contact → Prospect", rate: dispContacts > 0 ? ((dispProspects / dispContacts) * 100) : 0, prev: prevContactRate },
                    { label: "Contact → Lead", rate: dispContacts > 0 ? ((dispLeads / dispContacts) * 100) : 0, prev: prevLeadRate },
                    { label: "Lead → Visit", rate: dispLeads > 0 ? ((dispHomeVisits / dispLeads) * 100) : 0, prev: prevVisitRate },
                    { label: "Visit → Won", rate: dispHomeVisits > 0 ? ((dispWonJobs / dispHomeVisits) * 100) : 0, prev: prevWonRate },
                  ];
                })().map((c) => {
                  const delta = c.prev != null ? c.rate - c.prev : null;
                  const better = delta != null && delta >= 0;
                  return (
                    <span key={c.label} style={{ fontSize: "11px", color: "#64748B", display: "inline-flex", alignItems: "baseline", gap: "5px" }}>
                      {c.label} <strong style={{ color: "#0F172A" }}>{c.rate.toFixed(1)}%</strong>
                      {delta != null && (
                        <span style={{ fontSize: "10px", fontWeight: 700, color: better ? "#059669" : "#DC2626" }}>
                          {better ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}pp
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
            {!isSourceFiltered && funnelTiming && (
              (() => {
                const fmt = (avg: number | null, sample: number) =>
                  avg == null
                    ? <span style={{ color: "#CBD5E1" }}>—</span>
                    : <>
                        <strong style={{ color: "#0F172A" }}>{avg.toFixed(1)} days</strong>
                        <span style={{ color: "#94A3B8", marginLeft: "3px" }}>(n={sample})</span>
                      </>;
                return (
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "8px 14px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Avg time in funnel
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      Prospect → Lead {fmt(funnelTiming.prospectToLead.avgDays, funnelTiming.prospectToLead.sample)}
                    </span>
                    <span style={{ color: "#CBD5E1", fontSize: "11px" }}>·</span>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      Lead → Visit {fmt(funnelTiming.leadToVisit.avgDays, funnelTiming.leadToVisit.sample)}
                    </span>
                    <span style={{ color: "#CBD5E1", fontSize: "11px" }}>·</span>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      Prospect → Visit {fmt(funnelTiming.prospectToVisit.avgDays, funnelTiming.prospectToVisit.sample)}
                    </span>
                  </div>
                );
              })()
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr", gap: "0", alignItems: "stretch" }}>
              <FunnelCard
                title="Prospects"
                subtitle="Browsing, not ready to talk"
                total={dispProspects}
                colour="#F59E0B"
                bg="#FFFBEB"
                rate={dispContacts > 0 ? `${((dispProspects / dispContacts) * 100).toFixed(1)}% of contacts` : undefined}
                comparison={!isSourceFiltered && previousPeriod ? { current: prospectsTotal, previous: previousPeriod.prospects } : undefined}
              >
                {(sourceSlice
                  ? sourceSlice.prospectActions.map((a) => ({ value: a.value, count: a.count }))
                  : prospects.sort((a, b) => b.count - a.count)
                ).map((action) => (
                  <MiniRow key={action.value} label={PROSPECT_ACTIONS[action.value] ?? action.value} count={action.count} />
                ))}
                {funnelBySource && !isSourceFiltered && (() => {
                  const bySource = funnelBySource.sources
                    .filter((s) => s.prospects > 0)
                    .map((s) => ({ label: s.label, count: s.prospects }))
                    .sort((a, b) => b.count - a.count);
                  if (bySource.length === 0) return null;
                  return (
                    <>
                      <div style={{ fontSize: "8px", fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px" }}>
                        Original Lead Source
                      </div>
                      {bySource.map((s) => (
                        <MiniRow key={`psrc-${s.label}`} label={s.label} count={s.count} />
                      ))}
                    </>
                  );
                })()}
              </FunnelCard>
              <ConversionArrow
                rate={(() => {
                  if (isSourceFiltered) return dispProspects > 0 ? ((dispLeads / dispProspects) * 100).toFixed(1) : "0";
                  if (prospectToLead?.rate != null) return prospectToLead.rate.toFixed(1);
                  return "—";
                })()}
                label="Prospect → Lead"
              />
              <FunnelCard
                title="Leads"
                subtitle="Want to talk"
                total={dispLeads}
                colour="#3B82F6"
                bg="#EFF6FF"
                rate={dispContacts > 0 ? `${((dispLeads / dispContacts) * 100).toFixed(1)}% of contacts` : undefined}
                comparison={!isSourceFiltered && previousPeriod ? { current: leadsTotal, previous: previousPeriod.leads } : undefined}
              >
                {(sourceSlice
                  ? sourceSlice.leadActions.map((a) => ({ value: a.value, count: a.count }))
                  : leads.sort((a, b) => b.count - a.count)
                ).map((action) => (
                  <MiniRow key={action.value} label={LEAD_ACTIONS[action.value] ?? action.value} count={action.count} />
                ))}
                {dispDirectBookings > 0 && (
                  <>
                    <div style={{ borderTop: "1px dashed #CBD5E1", margin: "6px 0", position: "relative" }}>
                      <span style={{ position: "absolute", top: "-7px", left: "50%", transform: "translateX(-50%)", background: "#EFF6FF", padding: "0 6px", fontSize: "8px", fontWeight: 700, color: "#3B82F6", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Organic</span>
                    </div>
                    <MiniRow label="Direct bookings (no lead form)" count={dispDirectBookings} highlight />
                  </>
                )}
                {funnelBySource && !isSourceFiltered && (() => {
                  const bySource = funnelBySource.sources
                    .filter((s) => (s.formLeads + s.directBookings) > 0)
                    .map((s) => ({ label: s.label, count: s.formLeads + s.directBookings }))
                    .sort((a, b) => b.count - a.count);
                  if (bySource.length === 0) return null;
                  return (
                    <>
                      <div style={{ fontSize: "8px", fontWeight: 700, color: "#3B82F6", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px" }}>
                        Original Lead Source
                      </div>
                      {bySource.map((s) => (
                        <MiniRow key={`lsrc-${s.label}`} label={s.label} count={s.count} />
                      ))}
                    </>
                  );
                })()}
              </FunnelCard>
              <ConversionArrow
                rate={dispLeads > 0 ? ((dispHomeVisits / dispLeads) * 100).toFixed(1) : "0"}
                label="Lead → Visit"
                secondaryRate={dispContacts > 0 ? ((dispHomeVisits / dispContacts) * 100).toFixed(1) : "0"}
                secondaryLabel="Contact → Visit"
              />
              <FunnelCard
                title="Home Visits"
                subtitle="Visit booked"
                total={dispHomeVisits}
                colour="#10B981"
                bg="#ECFDF5"
                rate={dispLeads > 0 ? `Lead → Visit ${((dispHomeVisits / dispLeads) * 100).toFixed(1)}%` : undefined}
                comparison={!isSourceFiltered && previousPeriod ? { current: homeVisits ?? 0, previous: previousPeriod.homeVisits } : undefined}
              >
                {!isSourceFiltered && homeVisitBreakdown && homeVisitBreakdown.total > 0 ? (
                  <>
                    {homeVisitBreakdown.byAction.length > 0 && (
                      <>
                        <div style={{ fontSize: "8px", fontWeight: 700, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.5px", margin: "2px 0 4px" }}>
                          Conversion Action
                        </div>
                        {homeVisitBreakdown.byAction.map((a) => (
                          <MiniRow key={`act-${a.value}`} label={a.label} count={a.count} />
                        ))}
                      </>
                    )}
                    {homeVisitBreakdown.bySource.length > 0 && (
                      <>
                        <div style={{ fontSize: "8px", fontWeight: 700, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px" }}>
                          Original Lead Source
                        </div>
                        {homeVisitBreakdown.bySource.map((s) => (
                          <MiniRow key={`src-${s.value}`} label={s.label} count={s.count} />
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 0" }}>
                    <span style={{ fontSize: "32px", fontWeight: 800, color: "#059669", lineHeight: 1 }}>{dispHomeVisits.toLocaleString()}</span>
                  </div>
                )}
              </FunnelCard>
              <ConversionArrow rate={dispHomeVisits > 0 ? ((dispWonJobs / dispHomeVisits) * 100).toFixed(1) : "0"} label="Visit → Won" />
              <FunnelCard
                title="Won Jobs"
                subtitle="Deal won"
                total={dispWonJobs}
                colour="#059669"
                bg="#ECFDF5"
                rate={dispHomeVisits > 0 ? `${((dispWonJobs / dispHomeVisits) * 100).toFixed(1)}% of visits` : undefined}
                comparison={!isSourceFiltered && previousPeriod ? { current: wonJobs ?? 0, previous: previousPeriod.wonJobs } : undefined}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0", gap: "2px" }}>
                  <span style={{ fontSize: "32px", fontWeight: 800, color: "#059669", lineHeight: 1 }}>{dispWonJobs.toLocaleString()}</span>
                  {!isSourceFiltered && wonValue !== null && wonValue > 0 && (
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#047857" }}>£{wonValue.toLocaleString()}</span>
                  )}
                </div>
                {!isSourceFiltered && wonBySource.length > 0 && (
                  <>
                    <div style={{ fontSize: "8px", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px" }}>
                      Original Lead Source
                    </div>
                    {wonBySource.map((s) => (
                      <MiniRow key={`wsrc-${s.label}`} label={`${s.label}${s.value > 0 ? ` (£${s.value.toLocaleString()})` : ""}`} count={s.count} />
                    ))}
                  </>
                )}
              </FunnelCard>
            </div>

            </div>

            <div>
            <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Contacts Per Team
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              {categoryCards.map((cat) => {
                const goalPct = cat.title === "PPC" ? goals.ppcPercentGoal
                  : cat.title === "SEO" ? goals.seoPercentGoal
                  : cat.title === "Content" ? goals.contentPercentGoal
                  : cat.title === "Other" ? goals.otherPercentGoal
                  : null;
                const teamPct = cat.title === "PPC" ? goals.ppcPercentGoal
                  : cat.title === "SEO" ? goals.seoPercentGoal
                  : cat.title === "Content" ? goals.contentPercentGoal
                  : cat.title === "Other" ? goals.otherPercentGoal
                  : null;
                const teamGoalMonth = (goals.contactsGoalPerMonth && teamPct)
                  ? Math.round((goals.contactsGoalPerMonth * teamPct) / 100)
                  : (cat.title === "PPC" ? goals.ppcGoalPerMonth
                    : cat.title === "SEO" ? goals.seoGoalPerMonth
                    : cat.title === "Content" ? goals.contentGoalPerMonth
                    : cat.title === "Other" ? goals.otherGoalPerMonth
                    : null);
                const teamGoal = proratedGoal(teamGoalMonth);
                return (
                  <SourcePanel key={cat.title} {...cat} sourcesTotal={sourcesTotal} breakdown={sourceBreakdown[cat.title]} goalPercent={goalPct} teamGoal={teamGoal} />
                );
              })}
            </div>
            </div>

            {/* === AD SPEND === */}
            {adSpend.length > 0 && adSpendTotal > 0 && (
              <div>
                <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Ad Spend
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                  {/* Total card */}
                  <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px 16px", borderLeft: "3px solid #0F172A" }}>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", margin: "0 0 4px", textTransform: "uppercase" }}>Total Spend</p>
                    <p style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>
                      £{adSpendTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  {/* Per platform */}
                  {adSpend.filter((p) => p.spend > 0).map((p) => (
                    <div key={p.name} style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px 16px", borderLeft: `3px solid ${p.colour}` }}>
                      <p style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", margin: "0 0 4px", textTransform: "uppercase" }}>{p.name}</p>
                      <p style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>
                        £{p.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {p.clicks > 0 && (
                        <p style={{ fontSize: "11px", color: "#94A3B8", margin: "4px 0 0" }}>
                          {p.clicks.toLocaleString()} clicks · £{(p.spend / p.clicks).toFixed(2)} CPC
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* === CHART + LIFECYCLE STAGES side by side === */}
            <div>
            <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Trends & Lifecycle
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* CHART with pill buttons — full width bar chart */}
              {(() => {
                const metrics = [
                  { key: "contacts", label: "Contacts", colour: "#6366F1" },
                  { key: "prospects", label: "Prospects", colour: "#F59E0B" },
                  { key: "leads", label: "Leads", colour: "#3B82F6" },
                  { key: "visits", label: "Home Visits", colour: "#10B981" },
                  { key: "visitors", label: "Visitors", colour: "#8B5CF6" },
                ];
                const active = metrics.find((m) => m.key === selectedMetric) ?? metrics[0];

                return (
                  <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ display: "flex", gap: "2px", background: "#F1F5F9", borderRadius: "8px", padding: "3px" }}>
                        {metrics.map((m) => (
                          <button
                            key={m.key}
                            onClick={() => switchMetric(m.key)}
                            style={{
                              fontSize: "10px",
                              fontWeight: selectedMetric === m.key ? 700 : 500,
                              color: selectedMetric === m.key ? "white" : "#64748B",
                              background: selectedMetric === m.key ? m.colour : "transparent",
                              border: "none",
                              borderRadius: "6px",
                              padding: "4px 10px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "all 0.15s",
                            }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>
                        {timelineData.reduce((s, d) => s + d.count, 0).toLocaleString()} total
                      </p>
                    </div>
                    {timelineLoading && (
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 2, background: "rgba(255,255,255,0.85)", borderRadius: "10px", padding: "12px 24px" }}>
                        <p style={{ fontSize: "13px", color: "#64748B", margin: 0, fontWeight: 600 }}>Loading...</p>
                      </div>
                    )}
                    <div style={{ width: "100%", height: 320, opacity: timelineLoading ? 0.3 : 1, transition: "opacity 0.2s" }}>
                      {timelineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={timelineData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 10, fill: "#94A3B8" }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(d: string) => {
                                if (timelineGranularity === "day") {
                                  const [, m, day] = d.split("-");
                                  return `${parseInt(day)}/${parseInt(m)}`;
                                }
                                return d;
                              }}
                              interval={timelineData.length > 20 ? Math.floor(timelineData.length / 10) : 0}
                            />
                            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip
                              labelFormatter={(d) => String(d)}
                              formatter={(value) => [Number(value).toLocaleString(), active.label]}
                              cursor={{ fill: "#F1F5F9" }}
                              contentStyle={{ borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                            />
                            <Bar
                              dataKey="count"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={48}
                            >
                              {timelineData.map((d, i) => {
                                // Only daily granularity has a meaningful weekend concept
                                let isWeekend = false;
                                if (timelineGranularity === "day") {
                                  const dow = new Date(d.label + "T12:00:00").getDay();
                                  isWeekend = dow === 0 || dow === 6;
                                }
                                return <Cell key={i} fill={isWeekend ? "#F59E0B" : active.colour} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94A3B8", fontSize: "13px" }}>
                          Select a metric to see the trend
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ROW 2: Lifecycle pipeline + Visit conversion (both metric-independent) */}
              {(() => {
                const hasLifecycle = lifecycleStages.length > 0;
                const hasDow = dowConversion && dowConversion.contacts.some((c) => c > 0);
                if (!hasLifecycle && !hasDow) return null;
                const cols = hasLifecycle && hasDow ? "2fr 1fr" : "1fr";
                return (
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: "10px" }}>
              {/* LIFECYCLE STAGES */}
              {lifecycleStages.length > 0 && (
                <LifecyclePipeline stages={lifecycleStages} periodStages={lifecyclePeriod} />
              )}

              {/* VISIT CONVERSION BY DAY OF WEEK — answers "are weekend leads worth it?" */}
              {dowConversion && dowConversion.contacts.some((c) => c > 0) && (() => {
                  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

                  // Resolve which segment to display based on the dropdown
                  const sourceList = dowConversion.bySource ?? [];
                  const actionList = dowConversion.byAction ?? [];
                  let segContacts: number[];
                  let segVisits: number[];
                  let segLabel = "All contacts";
                  if (dowSegment.startsWith("source:")) {
                    const value = dowSegment.slice("source:".length);
                    const seg = sourceList.find((s) => s.value === value);
                    if (seg) {
                      segContacts = seg.contacts;
                      segVisits = seg.withVisit;
                      segLabel = seg.label;
                    } else {
                      segContacts = dowConversion.contacts;
                      segVisits = dowConversion.withVisit;
                    }
                  } else if (dowSegment.startsWith("action:")) {
                    const value = dowSegment.slice("action:".length);
                    const seg = actionList.find((a) => a.value === value);
                    if (seg) {
                      segContacts = seg.contacts;
                      segVisits = seg.withVisit;
                      segLabel = seg.label;
                    } else {
                      segContacts = dowConversion.contacts;
                      segVisits = dowConversion.withVisit;
                    }
                  } else {
                    segContacts = dowConversion.contacts;
                    segVisits = dowConversion.withVisit;
                  }

                  const rates = segContacts.map((c, i) =>
                    c > 0 ? (segVisits[i] / c) * 100 : 0
                  );
                  const maxRate = Math.max(...rates, 1);
                  const bestIdx = rates.indexOf(Math.max(...rates));

                  // Weekday vs weekend aggregate (filtered to current segment)
                  const wdContacts = segContacts.slice(0, 5).reduce((a, b) => a + b, 0);
                  const wdVisits = segVisits.slice(0, 5).reduce((a, b) => a + b, 0);
                  const weContacts = segContacts.slice(5).reduce((a, b) => a + b, 0);
                  const weVisits = segVisits.slice(5).reduce((a, b) => a + b, 0);
                  const wdRate = wdContacts > 0 ? (wdVisits / wdContacts) * 100 : 0;
                  const weRate = weContacts > 0 ? (weVisits / weContacts) * 100 : 0;

                  return (
                    <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px", display: "flex", flexDirection: "column", flex: 1, minHeight: "240px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Visit Conversion by Day
                        </p>
                        <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>% that book a visit</span>
                      </div>
                      <p style={{ fontSize: "11px", color: "#64748B", margin: "0 0 10px", lineHeight: 1.4 }}>
                        Showing <strong style={{ color: "#0F172A" }}>{segLabel}</strong>. The percentage of contacts entering on each day who go on to book a home visit.
                      </p>

                      {/* Segment selector */}
                      {(sourceList.length > 0 || actionList.length > 0) && (
                        <select
                          value={dowSegment}
                          onChange={(e) => setDowSegment(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            fontSize: "12px",
                            color: "#0F172A",
                            background: "#F8FAFC",
                            border: "1px solid #E2E8F0",
                            borderRadius: "8px",
                            marginBottom: "10px",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="__all__">All contacts ({dowConversion.contacts.reduce((a, b) => a + b, 0)})</option>
                          {sourceList.length > 0 && (
                            <optgroup label="By original lead source">
                              {sourceList.filter((s) => s.totalContacts > 0).map((s) => (
                                <option key={`source:${s.value}`} value={`source:${s.value}`}>
                                  {s.label} ({s.totalContacts})
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {actionList.length > 0 && (
                            <optgroup label="By conversion action">
                              {actionList.filter((a) => a.totalContacts > 0).map((a) => (
                                <option key={`action:${a.value}`} value={`action:${a.value}`}>
                                  {a.label} ({a.totalContacts})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      )}

                      {/* Weekday vs weekend headline */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "8px", padding: "8px 10px" }}>
                          <p style={{ fontSize: "10px", color: "#047857", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Weekday</p>
                          <p style={{ fontSize: "20px", fontWeight: 800, color: "#059669", margin: "2px 0 0", lineHeight: 1.1 }}>{wdRate.toFixed(1)}%</p>
                          <p style={{ fontSize: "10px", color: "#64748B", margin: "2px 0 0" }}>{wdVisits} of {wdContacts}</p>
                        </div>
                        <div style={{ background: weRate < wdRate ? "#FEF2F2" : "#ECFDF5", border: `1px solid ${weRate < wdRate ? "#FECACA" : "#A7F3D0"}`, borderRadius: "8px", padding: "8px 10px" }}>
                          <p style={{ fontSize: "10px", color: weRate < wdRate ? "#B91C1C" : "#047857", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Weekend</p>
                          <p style={{ fontSize: "20px", fontWeight: 800, color: weRate < wdRate ? "#DC2626" : "#059669", margin: "2px 0 0", lineHeight: 1.1 }}>{weRate.toFixed(1)}%</p>
                          <p style={{ fontSize: "10px", color: "#64748B", margin: "2px 0 0" }}>{weVisits} of {weContacts}</p>
                        </div>
                      </div>
                      {/* Per-day conversion bars */}
                      <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", flex: 1, minHeight: 0 }}>
                        {days.map((day, i) => {
                          const isWeekend = i >= 5;
                          const isBest = i === bestIdx;
                          const colour = isBest ? "#10B981" : isWeekend ? "#F59E0B" : "#6366F1";
                          return (
                            <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
                              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flex: 1, minHeight: 0 }}>
                                {segContacts[i] > 0 && (
                                  <span style={{ fontSize: "10px", fontWeight: 700, color: isBest ? "#059669" : "#0F172A", marginBottom: "2px" }}>
                                    {rates[i].toFixed(0)}%
                                  </span>
                                )}
                                <div
                                  title={`${segVisits[i]} of ${segContacts[i]} contacts booked a visit`}
                                  style={{
                                    width: "100%",
                                    maxWidth: "48px",
                                    height: `${Math.max((rates[i] / maxRate) * 100, rates[i] > 0 ? 4 : 0)}%`,
                                    background: colour,
                                    borderRadius: "4px 4px 0 0",
                                    transition: "height 0.3s ease",
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: "10px", fontWeight: 600, color: isBest ? "#059669" : isWeekend ? "#B45309" : "#64748B" }}>{day}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
                );
              })()}
            </div>

            </div>

            {/* === SITE VISITS — in-period count + 4-week forward calendar === */}
            {!isSourceFiltered && siteVisits && (
              <div>
                <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Site Visits
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "10px" }}>
                  {/* In-period count */}
                  <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Booked In Period
                    </p>
                    <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 8px" }}>
                      Visits booked in this date range, excluding cancelled
                    </p>
                    <p style={{ fontSize: "44px", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>
                      {siteVisits.inPeriod.toLocaleString()}
                    </p>
                    {siteVisits.cancelled > 0 && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                        <p style={{ fontSize: "20px", fontWeight: 800, color: "#DC2626", margin: 0, lineHeight: 1 }}>
                          {siteVisits.cancelled.toLocaleString()}
                        </p>
                        <p style={{ fontSize: "11px", color: "#64748B", margin: "2px 0 0", lineHeight: 1.3 }}>
                          cancelled
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 4-week forward calendar — independent of selected date range */}
                  <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Upcoming Calendar
                      </p>
                      <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>
                        Independent of date range
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                      {siteVisits.upcoming.map((wk, i) => {
                        const colours = ["#3B82F6", "#6366F1", "#8B5CF6", "#A855F7"];
                        const colour = colours[i] ?? "#3B82F6";
                        const fmtDay = (s: string) => {
                          const [, m, d] = s.split("-");
                          return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
                        };
                        return (
                          <div
                            key={wk.label}
                            style={{
                              background: `${colour}08`,
                              border: `1px solid ${colour}30`,
                              borderRadius: "10px",
                              padding: "12px 10px",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              textAlign: "center",
                            }}
                          >
                            {goals.siteVisitsGoalPerWeek != null && goals.siteVisitsGoalPerWeek > 0 && (() => {
                              const goal = goals.siteVisitsGoalPerWeek!;
                              const hit = wk.count >= goal;
                              const ringColour = hit ? "#10B981" : colour;
                              return (
                                <div
                                  style={{
                                    width: "44px",
                                    height: "44px",
                                    borderRadius: "50%",
                                    border: `2px solid ${ringColour}`,
                                    background: hit ? `${ringColour}15` : "white",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: "8px",
                                  }}
                                  title={`Goal: ${goal} visits`}
                                >
                                  <span style={{ fontSize: "16px", fontWeight: 800, color: ringColour, lineHeight: 1 }}>
                                    {goal}
                                  </span>
                                </div>
                              );
                            })()}
                            <p style={{ fontSize: "10px", fontWeight: 700, color: colour, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {wk.label}
                            </p>
                            <p style={{ fontSize: "10px", color: "#94A3B8", margin: "2px 0 6px" }}>
                              {fmtDay(wk.weekStart)} – {fmtDay(wk.weekEnd)}
                            </p>
                            <p style={{ fontSize: "32px", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>
                              {wk.count.toLocaleString()}
                            </p>
                            <p style={{ fontSize: "10px", color: "#64748B", margin: "4px 0 0" }}>
                              {wk.count === 1 ? "visit" : "visits"}
                            </p>
                            {wk.cancelled > 0 && (
                              <p style={{ fontSize: "10px", color: "#DC2626", margin: "4px 0 0", fontWeight: 600 }}>
                                {wk.cancelled} cancelled
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Salesman workload — 6 rows × 4 weeks, goal varies per rep */}
                {(() => {
                  const SALESMEN = ["Andy", "Barry", "Brian", "Dean", "Kevin", "Tony"];
                  const SALESMAN_GOALS: Record<string, number> = {
                    Andy: 10,
                    Barry: 10,
                    Brian: 6,
                    Dean: 10,
                    Kevin: 10,
                    Tony: 10,
                  };
                  const cellColour = (n: number, goal: number) => {
                    if (n >= goal) return { bg: "#ECFDF5", border: "#A7F3D0", text: "#059669" };
                    const ratio = n / goal;
                    if (ratio >= 0.7) return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" };
                    if (ratio >= 0.4) return { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" };
                    return { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" };
                  };
                  return (
                    <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "16px", marginTop: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Salesman Workload
                        </p>
                        <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>
                          Goal: 10 / week (Brian: 6)
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(70px, auto) repeat(4, 1fr)", gap: "6px", alignItems: "stretch" }}>
                        {/* Header row */}
                        <div />
                        {siteVisits.upcoming.map((wk) => (
                          <div key={wk.label} style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.5px", paddingBottom: "4px" }}>
                            {wk.label}
                          </div>
                        ))}
                        {/* One row per salesman */}
                        {SALESMEN.map((name) => (
                          <React.Fragment key={name}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center" }}>
                              {name}
                            </div>
                            {siteVisits.upcoming.map((wk) => {
                              const n = wk.bySalesman?.[name] ?? 0;
                              const goal = SALESMAN_GOALS[name] ?? 10;
                              const c = cellColour(n, goal);
                              const pct = Math.min(100, (n / goal) * 100);
                              return (
                                <div
                                  key={`${name}-${wk.label}`}
                                  style={{
                                    background: c.bg,
                                    border: `1px solid ${c.border}`,
                                    borderRadius: "8px",
                                    padding: "8px 10px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minHeight: "52px",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
                                    <span style={{ fontSize: "20px", fontWeight: 800, color: c.text, lineHeight: 1 }}>
                                      {n}
                                    </span>
                                    <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600 }}>
                                      / {goal}
                                    </span>
                                  </div>
                                  <div style={{ width: "100%", height: "3px", background: "#F1F5F9", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
                                    <div style={{ width: `${pct}%`, height: "100%", background: c.text, transition: "width 0.3s ease" }} />
                                  </div>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* === INSTALLS — 3 month forward calendar (deals: installation_date) === */}
            {!isSourceFiltered && installs && installs.months.length > 0 && (
              <div>
                <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Installs
                </h2>
                <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Upcoming Installs
                    </p>
                    <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>
                      Independent of date range · Excludes lost deals
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                    {installs.months.map((mo, i) => {
                      const colours = ["#7C3AED", "#9333EA", "#A855F7"];
                      const colour = colours[i] ?? "#7C3AED";
                      const goal = goals.installsGoalPerMonth;
                      const hit = goal != null && mo.count >= goal;
                      const ringColour = hit ? "#10B981" : colour;
                      return (
                        <div
                          key={mo.key}
                          style={{
                            background: `${colour}08`,
                            border: `1px solid ${colour}30`,
                            borderRadius: "10px",
                            padding: "16px 12px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                          }}
                        >
                          {goal != null && goal > 0 && (
                            <div
                              style={{
                                width: "52px",
                                height: "52px",
                                borderRadius: "50%",
                                border: `2px solid ${ringColour}`,
                                background: hit ? `${ringColour}15` : "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: "10px",
                              }}
                              title={`Goal: ${goal} installs`}
                            >
                              <span style={{ fontSize: "18px", fontWeight: 800, color: ringColour, lineHeight: 1 }}>
                                {goal}
                              </span>
                            </div>
                          )}
                          <p style={{ fontSize: "11px", fontWeight: 700, color: colour, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {mo.label}
                          </p>
                          <p style={{ fontSize: "10px", color: "#94A3B8", margin: "2px 0 8px" }}>
                            {mo.monthName} {mo.year}
                          </p>
                          <p style={{ fontSize: "40px", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>
                            {mo.count.toLocaleString()}
                          </p>
                          <p style={{ fontSize: "11px", color: "#64748B", margin: "4px 0 0" }}>
                            {mo.count === 1 ? "install" : "installs"}
                          </p>
                          {goal != null && goal > 0 && (
                            <p style={{ fontSize: "10px", color: hit ? "#059669" : "#DC2626", margin: "6px 0 0", fontWeight: 700 }}>
                              {hit ? `+${mo.count - goal} over goal` : `${goal - mo.count} below goal`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* === INITIAL OUTREACH FEEDBACK — split by source + by action === */}
            {!isSourceFiltered && outreachFeedback && outreachFeedback.feedback.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
                  <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Initial Outreach Feedback
                  </h2>
                  <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>
                    {outreachFeedback.total} call{outreachFeedback.total !== 1 ? "s" : ""} with feedback in this period
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {(["bySource", "byAction"] as const).map((dim) => {
                    const titles = {
                      bySource: "By Original Lead Source",
                      byAction: "By Conversion Action",
                    };
                    // Pick a colour band based on the feedback label so the bad
                    // ones (Time Wasters / Not Answering / Wrong Contact / etc.)
                    // jump out visually.
                    const feedbackColour = (label: string): { bar: string; text: string } => {
                      const l = label.toLowerCase();
                      if (l.includes("home visit booked")) return { bar: "#10B981", text: "#059669" };
                      if (l.includes("grant")) return { bar: "#10B981", text: "#059669" };
                      if (l.includes("discussing with family")) return { bar: "#3B82F6", text: "#2563EB" };
                      if (l.includes("timing") || l.includes("not yet ready")) return { bar: "#3B82F6", text: "#2563EB" };
                      if (l.includes("brochure only")) return { bar: "#F59E0B", text: "#B45309" };
                      if (l.includes("too expensive")) return { bar: "#F59E0B", text: "#B45309" };
                      if (l.includes("competitor")) return { bar: "#F59E0B", text: "#B45309" };
                      if (l.includes("part fitting") || l.includes("supply only") || l.includes("flooring")) return { bar: "#94A3B8", text: "#64748B" };
                      // The painful ones
                      if (l.includes("not answering")) return { bar: "#DC2626", text: "#B91C1C" };
                      if (l.includes("wrong contact")) return { bar: "#DC2626", text: "#B91C1C" };
                      if (l.includes("time wasters")) return { bar: "#DC2626", text: "#B91C1C" };
                      if (l.includes("doesn't know") || l.includes("didn't know")) return { bar: "#DC2626", text: "#B91C1C" };
                      return { bar: "#94A3B8", text: "#64748B" };
                    };
                    const maxCount = Math.max(...outreachFeedback.feedback.map((f) => f.count), 1);
                    return (
                      <div key={dim} style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {titles[dim]}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {outreachFeedback.feedback.map((f) => {
                            const c = feedbackColour(f.label);
                            const pct = (f.count / maxCount) * 100;
                            const top3 = f[dim].slice(0, 3);
                            return (
                              <div key={f.value}>
                                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "3px" }}>
                                  <span style={{ fontSize: "12px", fontWeight: 700, color: c.text }}>
                                    {f.label}
                                  </span>
                                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                                    {f.count}
                                  </span>
                                </div>
                                <div style={{ background: "#F1F5F9", borderRadius: "3px", height: "4px", overflow: "hidden" }}>
                                  <div style={{ width: `${pct}%`, height: "100%", background: c.bar, borderRadius: "3px", transition: "width 0.3s ease" }} />
                                </div>
                                {top3.length > 0 && (
                                  <p style={{ fontSize: "10px", color: "#64748B", margin: "4px 0 0", lineHeight: 1.3 }}>
                                    {top3.map((s, i) => (
                                      <span key={s.value}>
                                        {i > 0 && <span style={{ color: "#CBD5E1" }}> · </span>}
                                        <span>{s.label}</span>{" "}
                                        <strong style={{ color: "#334155" }}>{s.count}</strong>
                                      </span>
                                    ))}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === CUSTOMER JOURNEYS === */}
            {!isSourceFiltered && customerJourneys && customerJourneys.contactJourneys.length > 0 && (() => {
              // Client-side filtering from the raw per-contact data
              const filtered = customerJourneys.contactJourneys.filter((cj) => {
                if (journeyFilterSource && cj.leadSource !== journeyFilterSource) return false;
                if (journeyFilterAction && cj.conversionAction !== journeyFilterAction) return false;
                if (journeyFilterForm && !cj.forms.includes(journeyFilterForm)) return false;
                return true;
              });
              const isFiltered = !!(journeyFilterSource || journeyFilterAction || journeyFilterForm);

              // Re-aggregate filtered contacts into journey paths
              const pathCounts = new Map<string, number>();
              for (const cj of filtered) {
                const key = cj.steps.join(" → ");
                pathCounts.set(key, (pathCounts.get(key) ?? 0) + 1);
              }
              const filteredJourneys = Array.from(pathCounts.entries())
                .map(([path, count]) => ({ path, steps: path.split(" → "), count }))
                .sort((a, b) => b.count - a.count);

              // Touchpoint attribution: first / mid / last touch
              const MILESTONE_STEPS = new Set(["Home Visit", "Home Visit (Cancelled)", "Won"]);
              const isInteraction = (s: string) =>
                !MILESTONE_STEPS.has(s) && !s.startsWith("Waiting") && !filtered.some((cj) => cj.leadSource === s);
              const attrFirst = new Map<string, number>();
              const attrMid = new Map<string, number>();
              const attrLast = new Map<string, number>();
              for (const cj of filtered) {
                // Extract only interaction steps (skip lead source at [0], milestones, waiting)
                const interactions = cj.steps.filter(isInteraction);
                if (interactions.length === 0) continue;
                const first = interactions[0];
                const last = interactions[interactions.length - 1];
                attrFirst.set(first, (attrFirst.get(first) ?? 0) + 1);
                attrLast.set(last, (attrLast.get(last) ?? 0) + 1);
                for (let idx = 1; idx < interactions.length - 1; idx++) {
                  const mid = interactions[idx];
                  attrMid.set(mid, (attrMid.get(mid) ?? 0) + 1);
                }
              }
              const allTouchpoints = new Set([...attrFirst.keys(), ...attrMid.keys(), ...attrLast.keys()]);
              const attrData = [...allTouchpoints].map((name) => {
                const f = attrFirst.get(name) ?? 0;
                const m = attrMid.get(name) ?? 0;
                const l = attrLast.get(name) ?? 0;
                const total = f + m + l;
                return { name, first: f, mid: m, last: l, total };
              }).sort((a, b) => b.total - a.total);

              const hasVisit = (j: { steps: string[] }) => j.steps.some((s) => s === "Home Visit" || s === "Home Visit (Cancelled)" || s === "Won");
              const withVisit = filteredJourneys.filter(hasVisit);
              const withoutVisit = filteredJourneys.filter((j) => !hasVisit(j));
              const withVisitTotal = withVisit.reduce((s, j) => s + j.count, 0);
              const withoutVisitTotal = withoutVisit.reduce((s, j) => s + j.count, 0);

              const stepColour = (step: string): string => {
                if (step === "Won") return "#10B981";
                if (step === "Home Visit") return "#0EA5E9";
                if (step.includes("Cancelled")) return "#EF4444";
                if (step.includes("Phone") || step.includes("Call")) return "#F59E0B";
                if (step === "We Emailed") return "#3B82F6";
                if (step === "They Emailed") return "#06B6D4";
                if (step.startsWith("Waiting")) return "#F97316";
                return "#8B5CF6";
              };

              const pillStyle = (active: boolean): React.CSSProperties => ({
                fontSize: "10px",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: "20px",
                border: active ? "1px solid #2563eb" : "1px solid #E2E8F0",
                background: active ? "#EFF6FF" : "white",
                color: active ? "#2563eb" : "#64748B",
                cursor: "pointer",
                whiteSpace: "nowrap",
              });

              const renderJourneyList = (list: typeof filteredJourneys, barColour: string, limit: number, onShowMore: () => void) => {
                const maxCount = list.length > 0 ? list[0].count : 1;
                const visible = list.slice(0, limit);
                const remaining = list.length - limit;
                return (
                  <>
                    {visible.map((j, i) => {
                      const pct = (j.count / maxCount) * 100;
                      return (
                        <div key={i}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", flex: 1, minWidth: 0 }}>
                              {j.steps.map((step, si) => (
                                <span key={si} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  {si > 0 && <span style={{ color: "#CBD5E1", fontSize: "11px", fontWeight: 700 }}>→</span>}
                                  <span style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: stepColour(step),
                                    background: `${stepColour(step)}12`,
                                    borderRadius: "5px",
                                    padding: "2px 8px",
                                    whiteSpace: "nowrap",
                                  }}>
                                    {step}
                                  </span>
                                </span>
                              ))}
                            </div>
                            <span style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A", marginLeft: "12px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              {j.count}
                            </span>
                          </div>
                          <div style={{ background: "#F1F5F9", borderRadius: "3px", height: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: barColour, borderRadius: "3px", transition: "width 0.3s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                    {remaining > 0 && (
                      <button
                        type="button"
                        onClick={onShowMore}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#2563eb",
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          borderRadius: "8px",
                          padding: "6px 14px",
                          cursor: "pointer",
                          alignSelf: "center",
                          marginTop: "4px",
                        }}
                      >
                        Show {remaining} more
                      </button>
                    )}
                  </>
                );
              };

              return (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
                    <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Customer Journeys
                    </h2>
                    <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>
                      {filtered.length} contact{filtered.length !== 1 ? "s" : ""}{isFiltered ? ` (of ${customerJourneys.totalContacts})` : ""}
                    </span>
                  </div>

                  {/* Filter pills */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                    {isFiltered && (
                      <button type="button" onClick={() => { setJourneyFilterSource(null); setJourneyFilterAction(null); setJourneyFilterForm(null); setJourneyShowVisit(10); setJourneyShowNoVisit(10); }}
                        style={{ ...pillStyle(false), color: "#DC2626", borderColor: "#FECACA", background: "#FEF2F2" }}>
                        Clear filters
                      </button>
                    )}
                    {customerJourneys.filters.leadSources.map((s) => (
                      <button key={`s-${s}`} type="button" onClick={() => { setJourneyFilterSource(journeyFilterSource === s ? null : s); setJourneyShowVisit(10); setJourneyShowNoVisit(10); }} style={pillStyle(journeyFilterSource === s)}>
                        {s}
                      </button>
                    ))}
                    <span style={{ width: "1px", background: "#E2E8F0", margin: "0 2px" }} />
                    {customerJourneys.filters.conversionActions.map((a) => (
                      <button key={`a-${a}`} type="button" onClick={() => { setJourneyFilterAction(journeyFilterAction === a ? null : a); setJourneyShowVisit(10); setJourneyShowNoVisit(10); }} style={pillStyle(journeyFilterAction === a)}>
                        {a}
                      </button>
                    ))}
                    <span style={{ width: "1px", background: "#E2E8F0", margin: "0 2px" }} />
                    {customerJourneys.filters.forms.map((f) => (
                      <button key={`f-${f}`} type="button" onClick={() => { setJourneyFilterForm(journeyFilterForm === f ? null : f); setJourneyShowVisit(10); setJourneyShowNoVisit(10); }} style={pillStyle(journeyFilterForm === f)}>
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Touchpoint attribution — GA-style three-column layout */}
                  {attrData.length > 0 && (() => {
                    const totalFirst = attrData.reduce((s, t) => s + t.first, 0);
                    const totalMid = attrData.reduce((s, t) => s + t.mid, 0);
                    const totalLast = attrData.reduce((s, t) => s + t.last, 0);
                    const grandTotal = totalFirst + totalMid + totalLast;
                    const firstPct = grandTotal ? Math.round((totalFirst / grandTotal) * 100) : 0;
                    const midPct = grandTotal ? Math.round((totalMid / grandTotal) * 100) : 0;
                    const lastPct = grandTotal ? 100 - firstPct - midPct : 0;

                    // Sort each column independently by its count
                    const firstSorted = [...attrData].filter((t) => t.first > 0).sort((a, b) => b.first - a.first);
                    const midSorted = [...attrData].filter((t) => t.mid > 0).sort((a, b) => b.mid - a.mid);
                    const lastSorted = [...attrData].filter((t) => t.last > 0).sort((a, b) => b.last - a.last);

                    const renderColumn = (
                      items: typeof attrData,
                      field: "first" | "mid" | "last",
                      colour: string,
                    ) => {
                      const maxVal = items.length > 0 ? items[0][field] : 1;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {items.map((t) => (
                            <div key={t.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "11px", color: "#334155", fontWeight: 500, width: "120px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.name}>
                                {t.name}
                              </span>
                              <div style={{ flex: 1, background: "#F1F5F9", borderRadius: "3px", height: "14px", overflow: "hidden" }}>
                                <div style={{ width: `${(t[field] / maxVal) * 100}%`, height: "100%", background: colour, borderRadius: "3px", transition: "width 0.3s", minWidth: t[field] > 0 ? "2px" : "0" }} />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F172A", width: "30px", textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                                {t[field]}
                              </span>
                            </div>
                          ))}
                          {items.length === 0 && (
                            <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>None</p>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Touchpoint Attribution
                        </p>

                        {/* Header arrows with percentages */}
                        <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
                          {[
                            { label: "Early touchpoints", pct: firstPct, colour: "#8B5CF6" },
                            { label: "Mid touchpoints", pct: midPct, colour: "#94A3B8" },
                            { label: "Late touchpoints", pct: lastPct, colour: "#0EA5E9" },
                          ].map((col, ci) => (
                            <div key={ci} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                              <div style={{
                                flex: 1,
                                background: "#F8FAFC",
                                border: "1px dashed #CBD5E1",
                                borderRadius: ci === 0 ? "8px 0 0 8px" : ci === 2 ? "0 8px 8px 0" : "0",
                                padding: "8px 12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                              }}>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>{col.label}</span>
                                <span style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "white",
                                  background: col.colour,
                                  borderRadius: "10px",
                                  padding: "1px 8px",
                                }}>
                                  {col.pct}%
                                </span>
                              </div>
                              {ci < 2 && (
                                <span style={{ color: "#CBD5E1", fontSize: "16px", lineHeight: 1, margin: "0 -1px" }}>▸</span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Three-column bar charts */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                          <div>{renderColumn(firstSorted, "first", "#8B5CF6")}</div>
                          <div>{renderColumn(midSorted, "mid", "#94A3B8")}</div>
                          <div>{renderColumn(lastSorted, "last", "#0EA5E9")}</div>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {/* With Home Visit */}
                    <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#0EA5E9", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Reached Home Visit
                        </p>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>
                          {withVisitTotal}
                        </span>
                      </div>
                      {withVisit.length > 0 ? renderJourneyList(withVisit, "#0EA5E9", journeyShowVisit, () => setJourneyShowVisit((n) => n + 10)) : (
                        <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>None{isFiltered ? " matching filters" : " in this period"}</p>
                      )}
                    </div>
                    {/* Without Home Visit */}
                    <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#8B5CF6", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Not Yet Reached Home Visit
                        </p>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>
                          {withoutVisitTotal}
                        </span>
                      </div>
                      {withoutVisit.length > 0 ? renderJourneyList(withoutVisit, "#8B5CF6", journeyShowNoVisit, () => setJourneyShowNoVisit((n) => n + 10)) : (
                        <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>None{isFiltered ? " matching filters" : " in this period"}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* === REVIEWS + SOCIAL across the bottom === */}
            {(() => {
              const hasReviews = reviews.length > 0 && reviews.some((r) => r.total > 0);
              const hasSocial = social.length > 0 && social.some((s) => s.total > 0);
              if (!hasReviews && !hasSocial) return null;
              const reviewsCols = hasReviews && hasSocial ? "1fr 1fr" : "1fr";
              return (
            <div>
            <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Reviews & Social
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: reviewsCols, gap: "10px" }}>
              {/* REVIEWS */}
              {reviews.length > 0 && reviews.some((r) => r.total > 0) && (
                <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Reviews</p>
                    <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>
                      <span style={{ fontWeight: 800, color: "#0F172A", fontSize: "15px" }}>{reviewsTotal.toLocaleString()}</span> total
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${reviews.filter((r) => r.total > 0).length}, 1fr)`, gap: "6px" }}>
                    {reviews.filter((r) => r.total > 0).map((r) => (
                      <a key={r.name} href={r.url || undefined} target="_blank" rel="noopener noreferrer"
                        style={{ textDecoration: "none", background: `${r.colour}08`, borderRadius: "8px", border: `1px solid ${r.colour}25`, padding: "8px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: r.colour }}>{r.name}</span>
                          {r.rating > 0 && <span style={{ fontSize: "10px", fontWeight: 700, color: "#0F172A" }}>★ {r.rating}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                          <span style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{r.total.toLocaleString()}</span>
                          <span style={{ fontSize: "9px", color: "#64748B" }}>reviews</span>
                          {r.increase !== null && r.increase > 0 && (
                            <span style={{ fontSize: "9px", fontWeight: 700, color: "#059669", background: "#ECFDF5", borderRadius: "4px", padding: "1px 5px" }}>+{r.increase}</span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* SOCIAL */}
              {social.length > 0 && social.some((s) => s.total > 0) && (
                <div style={{ background: "white", borderRadius: "10px", border: "1px solid #E8ECF0", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Social Followers</p>
                    <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>
                      <span style={{ fontWeight: 800, color: "#0F172A", fontSize: "15px" }}>{socialTotal.toLocaleString()}</span> total
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${social.filter((s) => s.total > 0).length}, 1fr)`, gap: "6px" }}>
                    {social.filter((s) => s.total > 0).map((s) => (
                      <a key={s.name} href={s.url || undefined} target="_blank" rel="noopener noreferrer"
                        style={{ textDecoration: "none", background: `${s.colour}08`, borderRadius: "8px", border: `1px solid ${s.colour}25`, padding: "8px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: s.colour }}>{s.name}</span>
                          {!s.auto && <span style={{ fontSize: "8px", color: "#94A3B8", background: "#F1F5F9", borderRadius: "3px", padding: "1px 4px" }}>manual</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                          <span style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{s.total.toLocaleString()}</span>
                          <span style={{ fontSize: "9px", color: "#64748B" }}>followers</span>
                          {s.increase !== null && s.increase > 0 && (
                            <span style={{ fontSize: "9px", fontWeight: 700, color: "#059669", background: "#ECFDF5", borderRadius: "4px", padding: "1px 5px" }}>+{s.increase.toLocaleString()}</span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>
              );
            })()}



          </div>
        )}
      </main>

      {/* AI Insights floating button */}
      <button
        onClick={() => { if (aiInsights.length === 0 && !aiLoading) fetchAiInsights(); else setAiOpen(true); }}
        disabled={aiLoading}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 900,
          background: aiLoading ? "#A78BFA" : "#8B5CF6",
          color: "white",
          border: "none",
          borderRadius: "14px",
          padding: "12px 20px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: aiLoading ? "not-allowed" : "pointer",
          boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          transition: "all 0.2s",
        }}
      >
        {aiLoading && <div style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />}
        {aiLoading ? "Analysing..." : "AI Insights"}
      </button>

      {/* AI Insights slide-out panel */}
      {aiOpen && (
        <>
          <div onClick={() => setAiOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }} />
          <div style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "440px",
            zIndex: 1001,
            background: "#F8FAFC",
            boxShadow: "-8px 0 30px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            animation: "slideIn 0.25s ease",
          }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>AI Marketing Insights</h2>
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>Powered by Claude</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={fetchAiInsights}
                  disabled={aiLoading}
                  style={{ fontSize: "11px", fontWeight: 600, color: "#8B5CF6", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "8px", padding: "6px 12px", cursor: "pointer" }}
                >
                  {aiLoading ? "..." : "Refresh"}
                </button>
                <button
                  onClick={() => setAiOpen(false)}
                  style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {aiLoading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: "12px" }}>
                  <div style={{ width: "32px", height: "32px", border: "3px solid #E2E8F0", borderTop: "3px solid #8B5CF6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>Analysing your marketing data...</p>
                </div>
              )}
              {!aiLoading && aiInsights.map((insight, i) => {
                if (aiDismissed.has(i)) return null;
                // Split on ** for bold parts
                const parts = insight.split(/\*\*(.*?)\*\*/);
                return (
                  <div key={i} style={{
                    background: "white",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}>
                    <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#8B5CF6", background: "#F5F3FF", borderRadius: "4px", padding: "2px 6px", marginRight: "8px" }}>
                        {i + 1}
                      </span>
                      {parts.map((part, j) =>
                        j % 2 === 1
                          ? <strong key={j} style={{ color: "#0F172A" }}>{part}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => {
                          setAiDismissed((prev) => { const next = new Set(prev); next.add(i); return next; });
                          const boldMatch = insight.match(/\*\*(.*?)\*\*/);
                          const summary = boldMatch ? boldMatch[1] : insight.substring(0, 80);
                          fetch("/api/ai-feedback", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ accepted: summary }),
                          });
                        }}
                        style={{
                          flex: 1,
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#059669",
                          background: "#ECFDF5",
                          border: "1px solid #A7F3D0",
                          borderRadius: "8px",
                          padding: "8px",
                          cursor: "pointer",
                        }}
                      >
                        Will do this
                      </button>
                      <button
                        onClick={() => { setAiRejectingIdx(i); setAiRejectReason(""); }}
                        style={{
                          flex: 1,
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#64748B",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "8px",
                          padding: "8px",
                          cursor: "pointer",
                        }}
                      >
                        Not relevant
                      </button>
                    </div>
                    {aiRejectingIdx === i && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "-4px" }}>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Why? (optional)"
                          value={aiRejectReason}
                          onChange={(e) => setAiRejectReason(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const boldMatch = insight.match(/\*\*(.*?)\*\*/);
                              const summary = boldMatch ? boldMatch[1] : insight.substring(0, 80);
                              const full = aiRejectReason ? `${summary} (reason: ${aiRejectReason})` : summary;
                              setAiDismissed((prev) => { const next = new Set(prev); next.add(i); return next; });
                              setAiRejected((prev) => [...prev, full]);
                              fetch("/api/ai-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rejected: full }) });
                              setAiRejectingIdx(null);
                            }
                          }}
                          style={{ flex: 1, fontSize: "12px", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "6px 10px", background: "#F8FAFC" }}
                        />
                        <button
                          onClick={() => {
                            const boldMatch = insight.match(/\*\*(.*?)\*\*/);
                            const summary = boldMatch ? boldMatch[1] : insight.substring(0, 80);
                            const full = aiRejectReason ? `${summary} (reason: ${aiRejectReason})` : summary;
                            setAiDismissed((prev) => { const next = new Set(prev); next.add(i); return next; });
                            setAiRejected((prev) => [...prev, full]);
                            fetch("/api/ai-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rejected: full }) });
                            setAiRejectingIdx(null);
                          }}
                          style={{ fontSize: "11px", fontWeight: 600, color: "white", background: "#64748B", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer" }}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!aiLoading && aiInsights.length > 0 && aiDismissed.size === aiInsights.length && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#059669", margin: "0 0 8px" }}>All insights reviewed!</p>
                  <button
                    onClick={fetchAiInsights}
                    style={{ fontSize: "12px", fontWeight: 600, color: "#8B5CF6", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "8px", padding: "8px 16px", cursor: "pointer" }}
                  >
                    Get fresh insights
                  </button>
                </div>
              )}

              {/* Chat messages */}
              {aiChatMessages.length > 0 && (
                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {aiChatMessages.map((msg, i) => (
                    <div key={i} style={{
                      background: msg.role === "user" ? "#EFF6FF" : "white",
                      border: `1px solid ${msg.role === "user" ? "#BFDBFE" : "#E2E8F0"}`,
                      borderRadius: "10px",
                      padding: "10px 14px",
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "90%",
                    }}>
                      <p style={{ fontSize: "12px", color: "#334155", margin: 0, lineHeight: 1.5 }}>{msg.text}</p>
                    </div>
                  ))}
                  {aiChatLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px" }}>
                      <div style={{ width: "12px", height: "12px", border: "2px solid #E2E8F0", borderTop: "2px solid #8B5CF6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: "11px", color: "#94A3B8" }}>Thinking...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat input */}
            <div style={{ padding: "12px 24px 16px", borderTop: "1px solid #E2E8F0", background: "white" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Ask about your data..."
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !aiChatLoading) sendAiChat(); }}
                  style={{ flex: 1, fontSize: "13px", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", background: "#F8FAFC" }}
                />
                <button
                  onClick={sendAiChat}
                  disabled={aiChatLoading || !aiChatInput.trim()}
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "white",
                    background: aiChatLoading ? "#A78BFA" : "#8B5CF6",
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 16px",
                    cursor: aiChatLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Ask
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showSettings && <SettingsModal initialGoals={goals} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

/* ── Components ── */

const LIFECYCLE_COLOURS: Record<string, string> = {
  "Prospect": "#8B5CF6",
  "Warm - Prospect": "#A78BFA",
  "Lead": "#3B82F6",
  "Home Visit/Deal ": "#0EA5E9",
  "Won - Waiting": "#14B8A6",
  "Completed": "#10B981",
  "Nurture": "#F59E0B",
  "Deal Recovery": "#F97316",
  "Deal Lost": "#EF4444",
  "Cold - Subscribed": "#64748B",
  "Cold - Unsubscribed": "#94A3B8",
  "Suppliers & Muppets": "#CBD5E1",
};

function LifecyclePipeline({ stages, periodStages }: { stages: { label: string; value: string; count: number }[]; periodStages: { label: string; value: string; count: number }[] }) {
  const total = stages.reduce((s, st) => s + st.count, 0);
  const periodMap = new Map(periodStages.map((s) => [s.value, s.count]));
  const hasPeriod = periodStages.length > 0;

  const featuredOrder = ["Cold - Unsubscribed", "Cold - Subscribed", "Prospect", "Lead"];
  const featuredStages = featuredOrder
    .map((label) => stages.find((s) => s.label === label))
    .filter((s): s is { label: string; value: string; count: number } => !!s);
  const featuredLabels = new Set(featuredOrder);
  const otherStages = stages.filter((s) => !featuredLabels.has(s.label) && s.count > 0);
  const maxCount = Math.max(...featuredStages.map((s) => s.count), 1);

  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        border: "1px solid #E2E8F0",
        padding: "16px 20px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#475569", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Lifecycle Stages
          </p>
          <span style={{ fontSize: "10px", color: "#94A3B8", background: "#F1F5F9", borderRadius: "6px", padding: "2px 8px", fontWeight: 500 }}>
            Live totals
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontWeight: 800, color: "#0F172A", fontSize: "15px" }}>{total.toLocaleString()}</span> contacts
        </p>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "stretch" }}>
        {/* Main pipeline */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: "8px 0" }}>
          {featuredStages.map((stage, i) => {
            const colour = LIFECYCLE_COLOURS[stage.label] ?? "#94A3B8";
            const sizeScale = Math.max(0.5, stage.count / maxCount);
            const size = Math.round(54 + sizeScale * 36);
            const periodCount = periodMap.get(stage.value) ?? 0;
            const isLead = stage.label === "Lead";
            const pct = ((stage.count / total) * 100).toFixed(1);

            return (
              <div key={stage.value} style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "center" }}>
                {i > 0 && (
                  <svg width="40" height="20" viewBox="0 0 40 20" style={{ flexShrink: 0, opacity: 0.4 }}>
                    <line x1="0" y1="10" x2="30" y2="10" stroke="#CBD5E1" strokeWidth="2" />
                    <polygon points="30,5 40,10 30,15" fill="#CBD5E1" />
                  </svg>
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <div
                    title={`${stage.label}: ${stage.count.toLocaleString()} (${pct}%)`}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      borderRadius: "50%",
                      background: isLead
                        ? `radial-gradient(circle at 30% 30%, ${colour}30, ${colour}12)`
                        : `radial-gradient(circle at 30% 30%, ${colour}20, ${colour}08)`,
                      border: `${isLead ? "3.5px" : "2.5px"} solid ${colour}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                      transition: "all 0.3s ease",
                      boxShadow: isLead ? `0 0 20px ${colour}35, 0 0 40px ${colour}15` : `0 2px 8px ${colour}15`,
                    }}
                  >
                    <span style={{ fontSize: size > 72 ? "17px" : size > 60 ? "14px" : "12px", fontWeight: 800, color: colour, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {stage.count.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 600, color: `${colour}99`, lineHeight: 1 }}>
                      {pct}%
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: isLead ? 800 : 600, color: isLead ? colour : "#475569", textAlign: "center", lineHeight: 1.2 }}>
                    {stage.label}
                  </span>
                  {hasPeriod && (
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: periodCount > 0 ? "#059669" : "#CBD5E1",
                      background: periodCount > 0 ? "#ECFDF5" : "#F8FAFC",
                      borderRadius: "10px",
                      padding: "3px 12px",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {periodCount > 0 ? `+${periodCount.toLocaleString()}` : "—"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        {otherStages.length > 0 && (
          <div style={{ width: "1px", background: "#E2E8F0", alignSelf: "stretch", margin: "8px 0" }} />
        )}

        {/* Other stages table */}
        {otherStages.length > 0 && (
          <div style={{ minWidth: "190px", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#94A3B8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Other Stages
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {otherStages.map((stage) => {
                const colour = LIFECYCLE_COLOURS[stage.label] ?? "#94A3B8";
                const periodCount = periodMap.get(stage.value) ?? 0;
                return (
                  <div
                    key={stage.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      gap: "10px",
                      background: "#FAFBFC",
                    }}
                  >
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: colour, flexShrink: 0 }} />
                    <span style={{ color: "#475569", fontWeight: 500, fontSize: "11px", flex: 1 }}>{stage.label}</span>
                    <span style={{ fontWeight: 700, color: "#0F172A", fontSize: "12px", fontVariantNumeric: "tabular-nums", minWidth: "36px", textAlign: "right" }}>
                      {stage.count.toLocaleString()}
                    </span>
                    {hasPeriod && (
                      <span style={{ fontWeight: 600, fontSize: "10px", color: periodCount > 0 ? "#059669" : "#CBD5E1", fontVariantNumeric: "tabular-nums", minWidth: "28px", textAlign: "right" }}>
                        {periodCount > 0 ? `+${periodCount}` : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {hasPeriod && (
        <p style={{ fontSize: "10px", color: "#94A3B8", margin: "10px 0 0", textAlign: "center" }}>
          Green badges show contacts created in the selected date range
        </p>
      )}
    </div>
  );
}


function KpiCard({ label, value, colour, subtitle, detail, goal, comparison, liveNow }: { label: string; value: number | null; colour: string; subtitle?: string; detail?: string; goal?: { current: number; target: number }; comparison?: { current: number; previous: number }; liveNow?: number | null }) {
  const pct = goal ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  const met = goal ? goal.current >= goal.target : false;

  return (
    <div
      style={{
        background: "white",
        borderRadius: "10px",
        padding: "14px 16px",
        borderTop: "1px solid #E8ECF0",
        borderRight: "1px solid #E8ECF0",
        borderBottom: "1px solid #E8ECF0",
        borderLeft: `3px solid ${colour}`,
        transition: "all 0.15s ease",
      }}
    >
      <p style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </p>
      <p style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>
        {value !== null ? value.toLocaleString() : "—"}
      </p>
      {subtitle && (
        <p style={{ fontSize: "12px", color: subtitle.includes("cancelled") ? "#DC2626" : "#94A3B8", fontWeight: subtitle.includes("cancelled") ? 700 : 400, margin: "6px 0 0" }}>{subtitle}</p>
      )}
      {detail && (
        <p style={{ fontSize: "11px", color: "#3B82F6", margin: "4px 0 0", fontWeight: 600 }}>{detail}</p>
      )}
      {goal && (() => {
        const pctOfPace = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
        const delta = goal.current - goal.target;
        const ahead = delta >= 0;
        return (
          <div style={{ marginTop: "6px" }}>
            <div style={{ background: "#F1F5F9", borderRadius: "3px", height: "3px", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: "3px", background: met ? "#10B981" : colour, transition: "width 0.4s ease" }} />
            </div>
            <p style={{ fontSize: "10px", fontWeight: 600, color: met ? "#059669" : "#64748B", margin: "3px 0 0" }}>
              {goal.current} / {goal.target} goal · {pctOfPace.toFixed(0)}%
            </p>
            <p style={{ fontSize: "10px", fontWeight: 700, color: ahead ? "#059669" : "#DC2626", margin: "2px 0 0" }}>
              {ahead ? "▲" : "▼"} {Math.abs(delta)} {ahead ? "ahead of pace" : "behind pace"}
            </p>
          </div>
        );
      })()}
      {comparison && (
        <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: comparison.current >= comparison.previous ? "#059669" : "#DC2626" }}>
            {comparison.current >= comparison.previous ? "▲" : "▼"} {Math.abs(comparison.current - comparison.previous)}
          </span>
          <span style={{ fontSize: "10px", color: "#94A3B8" }}>vs prev period</span>
        </div>
      )}
      {liveNow != null && (
        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#059669" }}>{liveNow}</span>
          <span style={{ fontSize: "11px", color: "#64748B" }}>on site now</span>
        </div>
      )}
    </div>
  );
}

function SourcePanel({
  title,
  total,
  sources,
  colour,
  bg,
  icon,
  sourcesTotal,
  breakdown,
  goalPercent,
  teamGoal,
}: {
  title: string;
  total: number;
  sources: LeadSource[];
  colour: string;
  bg: string;
  icon: string;
  sourcesTotal: number;
  breakdown?: { prospects: number; leads: number };
  goalPercent?: number | null;
  teamGoal?: number | null;
}) {
  const filtered = sources.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  const pct = sourcesTotal > 0 ? ((total / sourcesTotal) * 100) : 0;
  const pctStr = pct.toFixed(1);

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "14px",
        border: "1px solid #E2E8F0",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: colour }} />
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", margin: 0 }}>{title}</p>
            <p style={{ fontSize: "10px", color: "#94A3B8", margin: "1px 0 0" }}>{icon}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "6px" }}>
            <p style={{ fontSize: "24px", fontWeight: 800, color: colour, margin: 0, lineHeight: 1 }}>
              {total.toLocaleString()}
            </p>
            {teamGoal && teamGoal > 0 && (
              <p style={{ fontSize: "14px", fontWeight: 600, color: total >= teamGoal ? "#059669" : "#94A3B8", margin: 0, lineHeight: 1 }}>
                / {teamGoal.toLocaleString()}
              </p>
            )}
          </div>
          <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>{pctStr}%</p>
        </div>
      </div>

      {/* Prospect vs Lead badges */}
      {breakdown && (breakdown.prospects > 0 || breakdown.leads > 0) && (
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1, background: "#FFFBEB", borderRadius: "8px", padding: "8px 12px", border: "1px solid #FDE68A" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#92400E", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Prospects</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#B45309", margin: "2px 0 0", lineHeight: 1 }}>{breakdown.prospects.toLocaleString()}</p>
          </div>
          <div style={{ flex: 1, background: "#EFF6FF", borderRadius: "8px", padding: "8px 12px", border: "1px solid #BFDBFE" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#1E40AF", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Leads</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#1D4ED8", margin: "2px 0 0", lineHeight: 1 }}>{breakdown.leads.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Goal vs actual */}
      {goalPercent && goalPercent > 0 && (
        <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "8px 12px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#64748B" }}>
            Goal: <strong>{goalPercent}%</strong> of contacts
          </span>
          <span style={{
            fontSize: "11px",
            fontWeight: 700,
            color: pct >= goalPercent ? "#059669" : "#DC2626",
            background: pct >= goalPercent ? "#ECFDF5" : "#FEF2F2",
            borderRadius: "6px",
            padding: "2px 8px",
          }}>
            {pct >= goalPercent ? "On target" : `${(goalPercent - pct).toFixed(1)}% below`}
          </span>
        </div>
      )}

      {/* Share bar */}
      <div style={{ background: "#F1F5F9", borderRadius: "4px", height: "4px", overflow: "hidden", position: "relative" }}>
        <div
          style={{
            width: `${sourcesTotal > 0 ? (total / sourcesTotal) * 100 : 0}%`,
            height: "100%",
            background: colour,
            borderRadius: "4px",
            transition: "width 0.4s ease",
          }}
        />
        {goalPercent && goalPercent > 0 && (
          <div style={{ position: "absolute", left: `${goalPercent}%`, top: "-2px", width: "2px", height: "8px", background: "#0F172A", borderRadius: "1px", opacity: 0.5 }} title={`Goal: ${goalPercent}%`} />
        )}
      </div>

      {/* Breakdown rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {filtered.map((s) => (
          <div key={s.value} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#334155" }}>{s.label}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
              {s.count.toLocaleString()}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontSize: "11px", color: "#CBD5E1", margin: 0 }}>No data</p>
        )}
      </div>
    </div>
  );
}

function ConversionArrow({
  rate,
  label,
  secondaryRate,
  secondaryLabel,
}: {
  rate: string;
  label: string;
  secondaryRate?: string;
  secondaryLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 4px",
        minWidth: "44px",
      }}
    >
      <span style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
        {rate}%
      </span>
      <svg width="24" height="16" viewBox="0 0 24 16" style={{ margin: "4px 0" }}>
        <path d="M4 8 L16 8 M12 3 L18 8 L12 13" stroke="#94A3B8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: "9px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.3px", textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </span>
      {secondaryRate !== undefined && secondaryLabel && (
        <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #E2E8F0", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
            {secondaryRate}%
          </span>
          <span style={{ fontSize: "9px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.3px", textAlign: "center", lineHeight: 1.2 }}>
            {secondaryLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function FunnelCard({
  title,
  subtitle,
  total,
  colour,
  bg,
  rate,
  comparison,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  colour: string;
  bg: string;
  rate?: string;
  comparison?: { current: number; previous: number };
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        border: "1px solid #E2E8F0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: bg,
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `2px solid ${colour}20`,
        }}
      >
        <div>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "10px", color: "#64748B", margin: "1px 0 0" }}>{subtitle}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "20px", fontWeight: 800, color: colour, lineHeight: 1 }}>
            {total.toLocaleString()}
          </span>
          {comparison && (() => {
            const delta = comparison.current - comparison.previous;
            const better = delta >= 0;
            return (
              <p style={{ fontSize: "10px", fontWeight: 700, color: better ? "#059669" : "#DC2626", margin: "2px 0 0" }}>
                {better ? "▲" : "▼"} {Math.abs(delta).toLocaleString()}{" "}
                <span style={{ color: "#94A3B8", fontWeight: 500 }}>vs prev</span>
              </p>
            );
          })()}
          {rate && (
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", margin: "2px 0 0" }}>{rate}</p>
          )}
        </div>
      </div>
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {children}
      </div>
    </div>
  );
}

function MiniRow({ label, count, highlight }: { label: string; count: number; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: highlight ? "#DBEAFE" : "transparent", borderRadius: highlight ? "6px" : 0, padding: highlight ? "4px 8px" : 0 }}>
      <span style={{ fontSize: "12px", color: highlight ? "#1D4ED8" : "#334155", fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 700, color: highlight ? "#1D4ED8" : "#0F172A", fontVariantNumeric: "tabular-nums" }}>
        {count.toLocaleString()}
      </span>
    </div>
  );
}

function GoalBar({
  current,
  monthlyGoal,
  label,
  colour,
  from,
  to,
}: {
  current: number;
  monthlyGoal: number;
  label: string;
  colour: string;
  from: string;
  to: string;
}) {
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");
  const now = new Date();

  const rangeDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const dailyRate = monthlyGoal / 30.44;
  const goal = Math.max(1, Math.round(dailyRate * rangeDays));

  const pct = Math.min((current / goal) * 100, 100);
  const met = current >= goal;
  const barColour = met ? "#10B981" : colour;

  let expectedPct: number;
  let expected: number;
  let paceLabel: string;
  let periodLabel: string;

  if (now >= toDate) {
    expectedPct = 100;
    expected = goal;
    periodLabel = `${rangeDays} days (complete)`;
    paceLabel = `Target: ${goal}`;
  } else if (now <= fromDate) {
    expectedPct = 0;
    expected = 0;
    periodLabel = `${rangeDays} days (not started)`;
    paceLabel = "Not started yet";
  } else {
    const elapsed = Math.round((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    expectedPct = (elapsed / rangeDays) * 100;
    expected = Math.round((elapsed / rangeDays) * goal);
    periodLabel = `Day ${elapsed} of ${rangeDays}`;
    paceLabel = expected <= 1 ? "Just getting started" : `Target: ${expected} by now`;
  }

  const onTrack = current >= expected;
  const justStarted = now <= fromDate || (now > fromDate && Math.round((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) < 1);

  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "18px 20px",
        border: `1px solid ${met ? "#A7F3D0" : "#E2E8F0"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "20px", fontWeight: 800, color: barColour }}>{current}</span>
          <span style={{ fontSize: "13px", color: "#94A3B8" }}>/ {goal}</span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: barColour,
              background: met ? "#D1FAE5" : `${colour}15`,
              borderRadius: "10px",
              padding: "2px 8px",
            }}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>

      <div style={{ position: "relative", background: "#F1F5F9", borderRadius: "4px", height: "6px", overflow: "visible", marginBottom: "8px" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: "4px",
            background: met ? "#10B981" : colour,
            transition: "width 0.4s ease",
            minWidth: current > 0 ? "4px" : "0",
          }}
        />
        {!met && !justStarted && (
          <div
            style={{
              position: "absolute",
              left: `${expectedPct}%`,
              top: "-3px",
              width: "2px",
              height: "12px",
              background: "#475569",
              borderRadius: "1px",
              opacity: 0.5,
            }}
            title={paceLabel}
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: met ? "#059669" : justStarted ? "#64748B" : onTrack ? "#059669" : "#DC2626",
          }}
        >
          {met ? "Goal met!" : justStarted ? paceLabel : onTrack ? "On track" : "Behind pace"}
          {!met && !justStarted && (
            <span style={{ fontWeight: 400, color: "#94A3B8", marginLeft: "6px" }}>
              — {paceLabel.toLowerCase()}
            </span>
          )}
        </span>
        <span style={{ fontSize: "11px", color: "#94A3B8" }}>{periodLabel}</span>
      </div>
    </div>
  );
}
