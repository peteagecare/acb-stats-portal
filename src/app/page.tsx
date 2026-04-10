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
          borderRadius: "22px",
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
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#1D1D1F" }}>
            Goals
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#F5F5F7",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              color: "#86868B",
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
          <div style={{ background: "#EFF6FF", borderRadius: "18px", padding: "20px", border: "2px solid #0071E3" }}>
            <label
              htmlFor="leadGoal"
              style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "#1D4ED8", marginBottom: "4px" }}
            >
              Lead Goal Per Month
            </label>
            <p style={{ fontSize: "12px", color: "#86868B", margin: "0 0 12px" }}>
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
                border: "2px solid #0071E3",
                borderRadius: "18px",
                padding: "12px 14px",
                fontSize: "18px",
                fontWeight: 600,
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
              <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "0 0 8px" }}>
                Target prospect actions
              </p>
              <input
                id="prospectsGoal"
                type="number"
                min="1"
                placeholder="e.g. 120"
                value={draftProspects}
                onChange={(e) => setDraftProspects(e.target.value)}
                style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="visitsMonthGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#047857", marginBottom: "4px" }}>
                Home Visits / Month
              </label>
              <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "0 0 8px" }}>
                Target visits booked
              </p>
              <input
                id="visitsMonthGoal"
                type="number"
                min="1"
                placeholder="e.g. 20"
                value={draftVisitsMonth}
                onChange={(e) => setDraftVisitsMonth(e.target.value)}
                style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }}
              />
            </div>
          </div>

          <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "-8px 0 0", textAlign: "center" }}>
            All goals auto-adjust to your selected date range
          </p>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          {/* Contacts goal */}
          <div>
            <label htmlFor="contactsGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#6366F1", marginBottom: "4px" }}>
              Contacts / Month (overall)
            </label>
            <input id="contactsGoal" type="number" min="1" placeholder="e.g. 800" value={draftContacts} onChange={(e) => setDraftContacts(e.target.value)}
              style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
          </div>

          {/* Site visits per week goal */}
          <div>
            <label htmlFor="siteVisitsWeekGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0071E3", marginBottom: "4px" }}>
              Site Visits / Week
            </label>
            <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "0 0 8px" }}>
              Shown as a goal circle on each upcoming-week card
            </p>
            <input
              id="siteVisitsWeekGoal"
              type="number"
              min="1"
              placeholder="e.g. 60"
              value={draftSiteVisitsWeek}
              onChange={(e) => setDraftSiteVisitsWeek(e.target.value)}
              style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }}
            />
          </div>

          {/* Installs per month goal */}
          <div>
            <label htmlFor="installsMonthGoal" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#7C3AED", marginBottom: "4px" }}>
              Installs / Month
            </label>
            <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "0 0 8px" }}>
              Shown as a goal circle on each install month card
            </p>
            <input
              id="installsMonthGoal"
              type="number"
              min="1"
              placeholder="e.g. 32"
              value={draftInstallsMonth}
              onChange={(e) => setDraftInstallsMonth(e.target.value)}
              style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }}
            />
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          {/* Manual overrides */}
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", marginBottom: "6px" }}>
              Manual Updates
            </p>
            <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "0 0 12px" }}>
              These can{"'"}t be fetched automatically — update when they change.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="fbReviews" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#1877F2", marginBottom: "4px" }}>Facebook Reviews</label>
                <input id="fbReviews" type="number" min="0" placeholder="e.g. 3" value={draftFbReviews} onChange={(e) => setDraftFbReviews(e.target.value)}
                  style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="liSam" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#0A66C2", marginBottom: "4px" }}>LinkedIn (Sam) Followers</label>
                <input id="liSam" type="number" min="0" placeholder="e.g. 500" value={draftLinkedInSam} onChange={(e) => setDraftLinkedInSam(e.target.value)}
                  style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          {/* Ad Spend */}
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", marginBottom: "6px" }}>
              Ad Spend (for selected period)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Google Ads", colour: "#4285F4", spend: draftGoogleSpend, setSpend: setDraftGoogleSpend, clicks: draftGoogleClicks, setClicks: setDraftGoogleClicks },
                { label: "Meta Ads", colour: "#1877F2", spend: draftMetaSpend, setSpend: setDraftMetaSpend, clicks: draftMetaClicks, setClicks: setDraftMetaClicks },
                { label: "Bing Ads", colour: "#00809D", spend: draftBingSpend, setSpend: setDraftBingSpend, clicks: draftBingClicks, setClicks: setDraftBingClicks },
              ].map((ad) => (
                <div key={ad.label} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: ad.colour, minWidth: "80px" }}>{ad.label}</span>
                  <div style={{ flex: 1 }}>
                    <input type="number" min="0" step="0.01" placeholder="£ spend" value={ad.spend} onChange={(e) => ad.setSpend(e.target.value)}
                      style={{ width: "100%", border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="number" min="0" placeholder="clicks" value={ad.clicks} onChange={(e) => ad.setClicks(e.target.value)}
                      style={{ width: "100%", border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", marginBottom: "6px" }}>
              Source Channel Goals (%)
            </p>
            <p style={{ fontSize: "12px", color: "#AEAEB2", margin: "0 0 12px" }}>
              Target percentage of leads + prospects from each channel.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="ppcGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#EF4444", marginBottom: "4px" }}>PPC %</label>
                <input id="ppcGoal" type="number" min="0" max="100" placeholder="e.g. 60" value={draftPpc} onChange={(e) => setDraftPpc(e.target.value)}
                  style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="seoGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#10B981", marginBottom: "4px" }}>SEO %</label>
                <input id="seoGoal" type="number" min="0" max="100" placeholder="e.g. 25" value={draftSeo} onChange={(e) => setDraftSeo(e.target.value)}
                  style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="contentGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#8B5CF6", marginBottom: "4px" }}>Content %</label>
                <input id="contentGoal" type="number" min="0" max="100" placeholder="e.g. 15" value={draftContent} onChange={(e) => setDraftContent(e.target.value)}
                  style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="otherGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#86868B", marginBottom: "4px" }}>Other %</label>
                <input id="otherGoal" type="number" min="0" max="100" placeholder="e.g. 15" value={draftOther} onChange={(e) => setDraftOther(e.target.value)}
                  style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", color: "#1D1D1F", boxSizing: "border-box", background: "#FAFAFA" }} />
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
                    <p style={{ fontSize: "11px", color: "#86868B", margin: "6px 0 0" }}>
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
              borderRadius: "18px",
              border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              background: "white",
              color: "#86868B",
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
              borderRadius: "18px",
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

/* ── Contact List Modal ── */

const HUBSPOT_HUB_ID = "25733939";

interface ContactRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  action: string;
  stage: string;
  created: string;
  lastActivity: string;
  daysSinceActivity: number | null;
}

function ContactListModal({ stage, colour, from, to, sourceCategory, onClose }: {
  stage: string;
  colour: string;
  from: string;
  to: string;
  sourceCategory?: string;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"name" | "stage" | "created" | "daysSinceActivity">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    setError(null);
    let url = `/api/hubspot/contact-list?from=${from}&to=${to}&stage=${encodeURIComponent(stage)}`;
    if (sourceCategory) url += `&sourceCategory=${encodeURIComponent(sourceCategory)}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch contacts");
        return r.json();
      })
      .then((data) => setContacts(data.contacts ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, stage, sourceCategory]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const sorted = [...contacts].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "name") return dir * a.name.localeCompare(b.name);
    if (sortField === "stage") {
      const order = ["Contact", "Prospect", "Lead", "Home Visit", "Won Job"];
      return dir * (order.indexOf(a.stage) - order.indexOf(b.stage));
    }
    if (sortField === "daysSinceActivity") {
      const da = a.daysSinceActivity ?? 9999;
      const db = b.daysSinceActivity ?? 9999;
      return dir * (da - db);
    }
    return dir * (new Date(a.created).getTime() - new Date(b.created).getTime());
  });

  const stageColour = (s: string) => {
    switch (s) {
      case "Contact": return "#6366F1";
      case "Prospect": return "#F59E0B";
      case "Lead": return "#0071E3";
      case "Home Visit": return "#10B981";
      case "Won Job": return "#059669";
      default: return "#86868B";
    }
  };

  const attentionBadge = (row: ContactRow) => {
    if (row.stage === "Won Job") return null;
    if (row.daysSinceActivity === null) {
      return { label: "No activity", bg: "#FEE2E2", colour: "#DC2626" };
    }
    if (row.daysSinceActivity > 14) {
      return { label: `${row.daysSinceActivity}d ago`, bg: "#FEE2E2", colour: "#DC2626" };
    }
    if (row.daysSinceActivity > 7) {
      return { label: `${row.daysSinceActivity}d ago`, bg: "#FEF3C7", colour: "#92400E" };
    }
    return null;
  };

  const sortArrow = (field: typeof sortField) =>
    sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px",
          width: "100%", maxWidth: "1200px", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #F5F5F7",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#1D1D1F" }}>
              {stage}{sourceCategory ? ` — ${sourceCategory}` : ""}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#86868B" }}>
              {from} to {to} &middot; {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#F5F5F7", border: "none", fontSize: "16px",
              color: "#86868B", cursor: "pointer", padding: "6px 10px",
              borderRadius: "10px", lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: "auto", flex: 1 }}>
          {loading && (
            <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>
              Loading contacts...
            </div>
          )}
          {error && (
            <div style={{ padding: "40px", textAlign: "center", color: "#DC2626" }}>
              {error}
            </div>
          )}
          {!loading && !error && contacts.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>
              No contacts found for this period.
            </div>
          )}
          {!loading && !error && contacts.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F5F5F7" }}>
                  <th onClick={() => handleSort("name")} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                    Name{sortArrow("name")}
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Email
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Phone
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Source
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Action
                  </th>
                  <th onClick={() => handleSort("stage")} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                    Stage{sortArrow("stage")}
                  </th>
                  <th onClick={() => handleSort("daysSinceActivity")} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                    Follow Up{sortArrow("daysSinceActivity")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const badge = attentionBadge(c);
                  const hsUrl = `https://app-eu1.hubspot.com/contacts/${HUBSPOT_HUB_ID}/record/0-1/${c.id}`;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => window.open(hsUrl, "_blank")}
                      style={{
                        borderBottom: "1px solid #F5F5F7",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#1D1D1F" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {c.name}
                          <span style={{ fontSize: "11px", color: "#AEAEB2" }}>↗</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>
                        {c.email}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>
                        {c.phone || <span style={{ color: "#D1D1D6" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>
                        {c.source || <span style={{ color: "#D1D1D6" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>
                        {c.action || <span style={{ color: "#D1D1D6" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "8px",
                          fontSize: "11px",
                          fontWeight: 500,
                          background: stageColour(c.stage) + "14",
                          color: stageColour(c.stage),
                        }}>
                          {c.stage}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {badge ? (
                          <span style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "8px",
                            fontSize: "11px",
                            fontWeight: 500,
                            background: badge.bg,
                            color: badge.colour,
                          }}>
                            {badge.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#AEAEB2" }}>OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Site Visit List Modal ── */

interface SiteVisitRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  visitDate: string;
  salesman: string;
  status: string;
}

function SiteVisitListModal({ title, from, to, mode, salesman, onClose }: {
  title: string;
  from: string;
  to: string;
  mode: "booked" | "scheduled";
  salesman?: string;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<SiteVisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let url = `/api/hubspot/site-visit-list?from=${from}&to=${to}&mode=${mode}`;
    if (salesman) url += `&salesman=${encodeURIComponent(salesman)}`;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((data) => setContacts(data.contacts ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, mode, salesman]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px",
          width: "100%", maxWidth: "1100px", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #F5F5F7",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#1D1D1F" }}>{title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#86868B" }}>
              {from} to {to} &middot; {contacts.length} visit{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "#F5F5F7", border: "none", fontSize: "16px", color: "#86868B", cursor: "pointer", padding: "6px 10px", borderRadius: "10px", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {loading && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>Loading...</div>}
          {error && <div style={{ padding: "40px", textAlign: "center", color: "#DC2626" }}>{error}</div>}
          {!loading && !error && contacts.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>No visits found.</div>}
          {!loading && !error && contacts.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F5F5F7" }}>
                  {["Name", "Email", "Phone", "Source", "Visit Date", "Salesman"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const hsUrl = `https://app-eu1.hubspot.com/contacts/${HUBSPOT_HUB_ID}/record/0-1/${c.id}`;
                  const fmtDate = c.visitDate ? new Date(c.visitDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
                  return (
                    <tr key={c.id} onClick={() => window.open(hsUrl, "_blank")} style={{ borderBottom: "1px solid #F5F5F7", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#1D1D1F" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>{c.name} <span style={{ fontSize: "11px", color: "#AEAEB2" }}>↗</span></div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.email}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.phone || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.source || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{fmtDate}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.salesman || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Install List Modal ── */

interface InstallRow {
  id: string;
  name: string;
  installDate: string;
  amount: string;
  stage: string;
}

function InstallListModal({ title, from, to, onClose }: {
  title: string;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const [deals, setDeals] = useState<InstallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/hubspot/install-list?from=${from}&to=${to}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((data) => setDeals(data.deals ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px",
          width: "100%", maxWidth: "900px", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #F5F5F7",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#1D1D1F" }}>{title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#86868B" }}>
              {from} to {to} &middot; {deals.length} install{deals.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "#F5F5F7", border: "none", fontSize: "16px", color: "#86868B", cursor: "pointer", padding: "6px 10px", borderRadius: "10px", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {loading && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>Loading...</div>}
          {error && <div style={{ padding: "40px", textAlign: "center", color: "#DC2626" }}>{error}</div>}
          {!loading && !error && deals.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>No installs found.</div>}
          {!loading && !error && deals.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F5F5F7" }}>
                  {["Deal Name", "Install Date", "Amount", "Stage"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const hsUrl = `https://app-eu1.hubspot.com/contacts/${HUBSPOT_HUB_ID}/record/0-3/${d.id}`;
                  const fmtDate = d.installDate ? new Date(d.installDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
                  return (
                    <tr key={d.id} onClick={() => window.open(hsUrl, "_blank")} style={{ borderBottom: "1px solid #F5F5F7", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#1D1D1F" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>{d.name} <span style={{ fontSize: "11px", color: "#AEAEB2" }}>↗</span></div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{fmtDate}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{d.amount ? `£${parseFloat(d.amount).toLocaleString()}` : <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{d.stage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Journey List Modal ── */

function JourneyListModal({ path, contacts, onClose }: {
  path: string;
  contacts: { id: string; name: string; email: string; phone: string; leadSource: string; conversionAction: string }[];
  onClose: () => void;
}) {
  const steps = path.split(" → ");
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px",
          width: "100%", maxWidth: "1000px", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #F5F5F7",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
              {steps.map((step, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  {i > 0 && <span style={{ color: "#D2D2D7", fontSize: "11px", fontWeight: 600 }}>→</span>}
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#1D1D1F", background: "#F5F5F7", borderRadius: "5px", padding: "2px 8px" }}>{step}</span>
                </span>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#86868B" }}>
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "#F5F5F7", border: "none", fontSize: "16px", color: "#86868B", cursor: "pointer", padding: "6px 10px", borderRadius: "10px", lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {contacts.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>No contacts found.</div>}
          {contacts.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F5F5F7" }}>
                  {["Name", "Email", "Phone", "Source", "Action"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const hsUrl = `https://app-eu1.hubspot.com/contacts/${HUBSPOT_HUB_ID}/record/0-1/${c.id}`;
                  return (
                    <tr key={c.id} onClick={() => window.open(hsUrl, "_blank")} style={{ borderBottom: "1px solid #F5F5F7", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#1D1D1F" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>{c.name} <span style={{ fontSize: "11px", color: "#AEAEB2" }}>↗</span></div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.email}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.phone || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.leadSource}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.conversionAction || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Feedback List Modal ── */

interface FeedbackRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  action: string;
  feedback: string;
  outreachDate: string;
}

function FeedbackListModal({ title, from, to, feedback, source, onClose }: {
  title: string;
  from: string;
  to: string;
  feedback?: string;
  source?: string;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let url = `/api/hubspot/feedback-list?from=${from}&to=${to}`;
    if (feedback) url += `&feedback=${encodeURIComponent(feedback)}`;
    if (source) url += `&source=${encodeURIComponent(source)}`;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((data) => setContacts(data.contacts ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, feedback, source]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px",
          width: "100%", maxWidth: "1100px", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #F5F5F7",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#1D1D1F" }}>{title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#86868B" }}>
              {from} to {to} &middot; {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "#F5F5F7", border: "none", fontSize: "16px", color: "#86868B", cursor: "pointer", padding: "6px 10px", borderRadius: "10px", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {loading && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>Loading...</div>}
          {error && <div style={{ padding: "40px", textAlign: "center", color: "#DC2626" }}>{error}</div>}
          {!loading && !error && contacts.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>No contacts found.</div>}
          {!loading && !error && contacts.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F5F5F7" }}>
                  {["Name", "Email", "Phone", "Source", "Action", "Feedback", "Outreach Date"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const hsUrl = `https://app-eu1.hubspot.com/contacts/${HUBSPOT_HUB_ID}/record/0-1/${c.id}`;
                  const fmtDate = c.outreachDate ? new Date(c.outreachDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
                  return (
                    <tr key={c.id} onClick={() => window.open(hsUrl, "_blank")} style={{ borderBottom: "1px solid #F5F5F7", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#1D1D1F" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>{c.name} <span style={{ fontSize: "11px", color: "#AEAEB2" }}>↗</span></div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.email}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.phone || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.source || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.action || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.feedback}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{fmtDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
    contactJourneys: { id: string; name: string; email: string; phone: string; path: string; steps: string[]; leadSource: string; conversionAction: string; forms: string[]; createdInPeriod: boolean }[];
  } | null>(null);
  const [journeyFilterSource, setJourneyFilterSource] = useState<string | null>(null);
  const [journeyFilterAction, setJourneyFilterAction] = useState<string | null>(null);
  const [journeyFilterForm, setJourneyFilterForm] = useState<string | null>(null);
  const [journeyShowVisit, setJourneyShowVisit] = useState(10);
  const [journeyShowNoVisit, setJourneyShowNoVisit] = useState(10);
  const [attrShowCount, setAttrShowCount] = useState(5);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

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
  const [contactListStage, setContactListStage] = useState<{ stage: string; colour: string; sourceCategory?: string } | null>(null);
  const [visitListModal, setVisitListModal] = useState<{ title: string; from: string; to: string; mode: "booked" | "scheduled"; salesman?: string } | null>(null);
  const [installListModal, setInstallListModal] = useState<{ title: string; from: string; to: string } | null>(null);
  const [feedbackListModal, setFeedbackListModal] = useState<{ title: string; feedback?: string; source?: string } | null>(null);
  const [journeyListModal, setJourneyListModal] = useState<{ path: string } | null>(null);
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
        setAttrShowCount(5);
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

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    const question = searchQuery.trim();
    setSearchLoading(true);
    setSearchOpen(true);
    setSearchHistory((prev) => [...prev, { role: "user", text: question }]);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: searchHistory,
          dashboardData: {
            dateFrom: from,
            dateTo: to,
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
            conversionActions: conversionActions.filter((a) => a.count > 0),
            sourceBreakdown,
            funnelTiming,
            wonBySource,
            prevContacts: previousPeriod?.contacts,
            prevLeads: previousPeriod?.leads,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchAnswer(data.answer);
        setSearchHistory((prev) => [...prev, { role: "ai", text: data.answer }]);
      } else {
        setSearchAnswer("Sorry, I couldn't process that question. Please try again.");
      }
    } catch {
      setSearchAnswer("Network error. Please try again.");
    } finally {
      setSearchLoading(false);
      setSearchQuery("");
    }
  }

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div className="dashboard-root" style={{ minHeight: "100vh", background: "#F5F5F7" }}>
      {/* Header */}
      <header style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "0 16px", position: "sticky", top: 0, zIndex: 200 }}>
        <div
          className="dashboard-header-bar"
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "56px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/acb-logo.png" alt="ACB" style={{ height: "28px", objectFit: "contain" }} />
            <div>
              <h1 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "#1D1D1F", letterSpacing: "-0.3px" }}>
                ACB Stats
              </h1>
              <p style={{ fontSize: "10px", margin: 0, color: "#86868B" }}>Marketing Funnel</p>
            </div>
          </div>

          {/* AI Search Bar */}
          <div ref={searchRef} style={{ position: "relative", flex: "0 1 420px", minWidth: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.04)", borderRadius: "12px", padding: "0 12px", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                <circle cx="11" cy="11" r="7" stroke="#1D1D1F" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="#1D1D1F" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchHistory.length > 0) setSearchOpen(true); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !searchLoading) handleSearch(); }}
                placeholder="Ask anything about your data..."
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  fontSize: "13px",
                  color: "#1D1D1F",
                  padding: "10px 0",
                  outline: "none",
                }}
              />
              {searchLoading && (
                <div style={{ width: "14px", height: "14px", border: "2px solid rgba(0,0,0,0.08)", borderTop: "2px solid #0071E3", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              )}
            </div>

            {/* Search results dropdown */}
            {searchOpen && (searchAnswer || searchHistory.length > 0) && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                background: "white",
                borderRadius: "16px",
                boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)",
                padding: "16px",
                zIndex: 300,
                maxHeight: "400px",
                overflowY: "auto",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {searchHistory.map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "90%",
                    }}>
                      {msg.role === "user" ? (
                        <p style={{ fontSize: "12px", color: "#86868B", margin: 0, textAlign: "right" }}>{msg.text}</p>
                      ) : (
                        <div style={{ background: "#F5F5F7", borderRadius: "12px", padding: "12px 14px" }}>
                          <p style={{ fontSize: "13px", color: "#1D1D1F", margin: 0, lineHeight: 1.6 }}>{msg.text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {searchLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 0" }}>
                      <div style={{ width: "12px", height: "12px", border: "2px solid rgba(0,0,0,0.06)", borderTop: "2px solid #0071E3", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <span style={{ fontSize: "12px", color: "#AEAEB2" }}>Thinking...</span>
                    </div>
                  )}
                </div>
                {searchHistory.length > 0 && !searchLoading && (
                  <button
                    type="button"
                    onClick={() => { setSearchHistory([]); setSearchAnswer(null); setSearchOpen(false); }}
                    style={{ fontSize: "11px", color: "#AEAEB2", background: "none", border: "none", cursor: "pointer", marginTop: "10px", padding: 0 }}
                  >
                    Clear conversation
                  </button>
                )}
              </div>
            )}
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
                <div className="dashboard-quick-ranges" style={{ display: "flex", gap: "2px", background: "rgba(0,0,0,0.04)", borderRadius: "8px", padding: "3px" }}>
                  {ranges.map((r) => {
                    const active = from === r.from && to === r.to;
                    return (
                      <button
                        key={r.label}
                        onClick={() => applyQuickRange(r.from, r.to)}
                        style={{
                          fontSize: "11px",
                          fontWeight: active ? 600 : 400,
                          color: active ? "white" : "#86868B",
                          background: active ? "#0071E3" : "transparent",
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
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.04)", borderRadius: "18px", padding: "6px 12px" }}>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1D1D1F",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <span style={{ color: "#86868B", fontSize: "12px" }}>&mdash;</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1D1D1F",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                background: loading ? "#334155" : "#0071E3",
                color: "white",
                fontWeight: 600,
                borderRadius: "18px",
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
                background: "rgba(0,0,0,0.04)",
                border: "none",
                borderRadius: "18px",
                padding: "8px",
                cursor: "pointer",
                color: "#AEAEB2",
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
            top: "56px",
            zIndex: 100,
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "10px", fontWeight: 500, color: "#86868B", marginRight: "4px" }}>
            Source
          </span>
          <button
            type="button"
            onClick={() => setSelectedSource(null)}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              border: !isSourceFiltered ? "1px solid #1D1D1F" : "1px solid rgba(0,0,0,0.1)",
              background: !isSourceFiltered ? "#1D1D1F" : "transparent",
              color: !isSourceFiltered ? "white" : "#86868B",
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
                  fontWeight: 600,
                  border: active ? "1px solid #0071E3" : "1px solid rgba(0,0,0,0.1)",
                  background: active ? "#0071E3" : "transparent",
                  color: active ? "white" : "#86868B",
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
            <span style={{ fontSize: "10px", color: "#86868B", marginLeft: "auto" }}>
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
              borderRadius: "18px",
              padding: "12px 16px",
              marginBottom: "20px",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* Full-screen loader — Apple-style minimal */}
        {!dataReady && (() => {
          const barWidth = 200;
          const earlyPhrases = [
            "Waking up the hamsters...",
            "Warming up the spreadsheets...",
            "Dusting off the database...",
            "Poking HubSpot with a stick...",
            "Bribing the servers...",
            "Untangling the internet cables...",
            "Asking Google nicely...",
            "Consulting the oracle...",
            "Firing up the flux capacitor...",
            "Tuning the marketing radar...",
          ];
          const midPhrases = [
            "Counting every last contact...",
            "Herding the data cats...",
            "Interrogating the leads...",
            "Deciphering the spreadsheet runes...",
            "Teaching numbers to behave...",
            "Rounding up the usual suspects...",
            "Cross-referencing with the biscuit tin...",
            "Whispering to the funnel...",
            "Translating from HubSpot to English...",
            "Doing maths so you don't have to...",
          ];
          const latePhrases = [
            "Polishing the charts...",
            "Making the numbers look pretty...",
            "Adding the finishing sparkles...",
            "Ironing the graphs...",
            "Nearly there, hold tight...",
            "Arranging pixels artistically...",
            "Just double-checking everything...",
            "Applying the final coat of paint...",
            "Tightening the last bolts...",
            "One last cup of tea...",
          ];
          const almostPhrases = [
            "Drumroll please...",
            "Aaaany second now...",
            "Putting the cherry on top...",
            "Clearing the runway...",
            "3... 2... 1...",
            "The suspense is killing us too...",
            "Worth the wait, promise...",
            "Just tying a bow on it...",
          ];
          const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
          const phrase = loadProgress < 15 ? pick(earlyPhrases)
            : loadProgress < 55 ? pick(midPhrases)
            : loadProgress < 85 ? pick(latePhrases)
            : pick(almostPhrases);
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "#F5F5F7",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "32px",
              }}
            >
              <img src="/acb-logo.png" alt="Age Care Bathrooms" style={{ height: "64px", objectFit: "contain" }} />

              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "17px", fontWeight: 500, color: "#1D1D1F", margin: "0 0 20px", letterSpacing: "-0.2px" }}>
                  {phrase}
                </p>
                {/* Thin progress bar */}
                <div style={{ width: `${barWidth}px`, height: "3px", borderRadius: "999px", background: "#E5E5EA", overflow: "hidden" }}>
                  <div style={{ width: `${loadProgress}%`, height: "100%", borderRadius: "999px", background: "#1D1D1F", transition: "width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)" }} />
                </div>
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
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#86868B", marginRight: "4px" }}>
                  Filter by source
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSource(null)}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: selectedSource === null ? "1px solid #0F172A" : "1px solid rgba(0,0,0,0.06)",
                    background: selectedSource === null ? "#0F172A" : "white",
                    color: selectedSource === null ? "white" : "#86868B",
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
                        fontWeight: 600,
                        border: active ? "1px solid #0071E3" : "1px solid rgba(0,0,0,0.06)",
                        background: active ? "#0071E3" : "white",
                        color: active ? "white" : "#86868B",
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
                  <span style={{ fontSize: "11px", color: "#AEAEB2", marginLeft: "auto", fontStyle: "italic" }}>
                    Cohort view: contacts created in this period from this source
                  </span>
                )}
              </div>
            )}
            {/* === GOALS SUMMARY === */}
            <div style={{ background: "white", borderRadius: "18px", border: "none", padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: 0 }}>
                  Goals
                </h2>
                <span style={{ fontSize: "11px", color: "#AEAEB2" }}>
                  Targets adjust to your selected date range
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: "12px" }}>
                {[
                  { label: "Contacts", current: dispContacts, goal: proratedGoal(goals.contactsGoalPerMonth), colour: "#6366F1" },
                  { label: "Prospects", current: dispProspects, goal: proratedGoal(goals.prospectsGoalPerMonth), colour: "#F59E0B" },
                  { label: "Leads", current: dispLeads, goal: proratedGoal(goals.leadGoalPerMonth), colour: "#0071E3" },
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
                          <span style={{ fontSize: "22px", fontWeight: 600, color: met ? "#059669" : "#0F172A", lineHeight: 1 }}>{g.current}</span>
                          <span style={{ fontSize: "11px", color: "#AEAEB2", fontWeight: 500 }}>/ {g.goal}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: met ? "#059669" : "#334155" }}>{g.label}</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: met ? "#059669" : g.colour }}>{met ? "Goal met" : `${pct.toFixed(0)}%`}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: 0 }}>
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
              <KpiCard label="Contacts" value={dispContacts} colour="#6366F1" comparison={!isSourceFiltered && previousPeriod ? { current: sourcesTotal, previous: previousPeriod.contacts } : undefined} onClick={() => setContactListStage({ stage: "Contacts", colour: "#6366F1" })} />
              <KpiCard label="Prospects" value={dispProspects} colour="#F59E0B" comparison={!isSourceFiltered && previousPeriod ? { current: prospectsTotal, previous: previousPeriod.prospects } : undefined} goal={!isSourceFiltered && proratedGoal(goals.prospectsGoalPerMonth) ? { current: prospectsTotal, target: proratedGoal(goals.prospectsGoalPerMonth)! } : undefined} onClick={() => setContactListStage({ stage: "Prospects", colour: "#F59E0B" })} />
              <KpiCard label="Leads" value={dispLeads} colour="#0071E3" comparison={!isSourceFiltered && previousPeriod ? { current: leadsTotal, previous: previousPeriod.leads } : undefined} detail={dispDirectBookings > 0 ? `${dispFormLeads} Form Leads + ${dispDirectBookings} Direct Bookings` : undefined} goal={!isSourceFiltered && proratedGoal(goals.leadGoalPerMonth) ? { current: leadsTotal, target: proratedGoal(goals.leadGoalPerMonth)! } : undefined} onClick={() => setContactListStage({ stage: "Leads", colour: "#0071E3" })} />
              <KpiCard label="Home Visits" value={dispHomeVisits} colour="#10B981" subtitle={siteVisits && siteVisits.cancelled > 0 ? `${siteVisits.cancelled} cancelled` : undefined} comparison={!isSourceFiltered && previousPeriod ? { current: homeVisits ?? 0, previous: previousPeriod.homeVisits } : undefined} goal={!isSourceFiltered && proratedGoal(goals.visitsGoalPerMonth) ? { current: homeVisits ?? 0, target: proratedGoal(goals.visitsGoalPerMonth)! } : undefined} onClick={() => setContactListStage({ stage: "Home Visits", colour: "#10B981" })} />
              <KpiCard label="Won Jobs" value={dispWonJobs} colour="#059669" subtitle={!isSourceFiltered && wonValue ? `£${wonValue.toLocaleString()} value` : undefined} comparison={!isSourceFiltered && previousPeriod ? { current: wonJobs ?? 0, previous: previousPeriod.wonJobs } : undefined} onClick={() => setContactListStage({ stage: "Won Jobs", colour: "#059669" })} />
            </div>
            </div>


            <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: 0 }}>
                  Funnel Breakdown
                </h2>
                {!isSourceFiltered && previousPeriod && (
                  <span style={{ fontSize: "10px", color: "#AEAEB2", fontWeight: 600 }}>
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
                    <span key={c.label} style={{ fontSize: "11px", color: "#86868B", display: "inline-flex", alignItems: "baseline", gap: "5px" }}>
                      {c.label} <strong style={{ color: "#1D1D1F" }}>{c.rate.toFixed(1)}%</strong>
                      {delta != null && (
                        <span style={{ fontSize: "10px", fontWeight: 600, color: better ? "#059669" : "#DC2626" }}>
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
                    ? <span style={{ color: "#D2D2D7" }}>—</span>
                    : <>
                        <strong style={{ color: "#1D1D1F" }}>{avg.toFixed(1)} days</strong>
                        <span style={{ color: "#AEAEB2", marginLeft: "3px" }}>(n={sample})</span>
                      </>;
                return (
                  <div style={{ background: "#FAFAFA", border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", borderRadius: "8px", padding: "8px 14px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#86868B" }}>
                      Avg time in funnel
                    </span>
                    <span style={{ fontSize: "11px", color: "#86868B" }}>
                      Prospect → Lead {fmt(funnelTiming.prospectToLead.avgDays, funnelTiming.prospectToLead.sample)}
                    </span>
                    <span style={{ color: "#D2D2D7", fontSize: "11px" }}>·</span>
                    <span style={{ fontSize: "11px", color: "#86868B" }}>
                      Lead → Visit {fmt(funnelTiming.leadToVisit.avgDays, funnelTiming.leadToVisit.sample)}
                    </span>
                    <span style={{ color: "#D2D2D7", fontSize: "11px" }}>·</span>
                    <span style={{ fontSize: "11px", color: "#86868B" }}>
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
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
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
                      <div style={{ fontSize: "8px", fontWeight: 600, color: "#F59E0B", margin: "10px 0 4px" }}>
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
                colour="#0071E3"
                bg="#EFF6FF"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
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
                      <span style={{ position: "absolute", top: "-7px", left: "50%", transform: "translateX(-50%)", background: "#EFF6FF", padding: "0 6px", fontSize: "8px", fontWeight: 600, color: "#0071E3", whiteSpace: "nowrap" }}>Organic</span>
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
                      <div style={{ fontSize: "8px", fontWeight: 600, color: "#0071E3", margin: "10px 0 4px" }}>
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
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                rate={dispLeads > 0 ? `Lead → Visit ${((dispHomeVisits / dispLeads) * 100).toFixed(1)}%` : undefined}
                comparison={!isSourceFiltered && previousPeriod ? { current: homeVisits ?? 0, previous: previousPeriod.homeVisits } : undefined}
              >
                {!isSourceFiltered && siteVisits && siteVisits.cancelled > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#DC2626" }}>{siteVisits.cancelled} cancelled</span>
                  </div>
                )}
                {!isSourceFiltered && homeVisitBreakdown && homeVisitBreakdown.total > 0 ? (
                  <>
                    {homeVisitBreakdown.byAction.length > 0 && (
                      <>
                        <div style={{ fontSize: "8px", fontWeight: 600, color: "#10B981", margin: "2px 0 4px" }}>
                          Conversion Action
                        </div>
                        {homeVisitBreakdown.byAction.map((a) => (
                          <MiniRow key={`act-${a.value}`} label={a.label} count={a.count} />
                        ))}
                      </>
                    )}
                    {homeVisitBreakdown.bySource.length > 0 && (
                      <>
                        <div style={{ fontSize: "8px", fontWeight: 600, color: "#10B981", margin: "10px 0 4px" }}>
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
                    <span style={{ fontSize: "32px", fontWeight: 600, color: "#059669", lineHeight: 1 }}>{dispHomeVisits.toLocaleString()}</span>
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
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                rate={dispHomeVisits > 0 ? `${((dispWonJobs / dispHomeVisits) * 100).toFixed(1)}% of visits` : undefined}
                comparison={!isSourceFiltered && previousPeriod ? { current: wonJobs ?? 0, previous: previousPeriod.wonJobs } : undefined}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0", gap: "2px" }}>
                  <span style={{ fontSize: "32px", fontWeight: 600, color: "#059669", lineHeight: 1 }}>{dispWonJobs.toLocaleString()}</span>
                  {!isSourceFiltered && wonValue !== null && wonValue > 0 && (
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#047857" }}>£{wonValue.toLocaleString()}</span>
                  )}
                </div>
                {!isSourceFiltered && wonBySource.length > 0 && (
                  <>
                    <div style={{ fontSize: "8px", fontWeight: 600, color: "#059669", margin: "10px 0 4px" }}>
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
            <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: "0 0 10px" }}>
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
                  <SourcePanel key={cat.title} {...cat} sourcesTotal={sourcesTotal} breakdown={sourceBreakdown[cat.title]} goalPercent={goalPct} teamGoal={teamGoal} onClick={() => setContactListStage({ stage: "Contacts", colour: cat.colour, sourceCategory: cat.title })} />
                );
              })}
            </div>
            </div>

            {/* === AD SPEND === */}
            {adSpend.length > 0 && adSpendTotal > 0 && (
              <div>
                <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: "0 0 10px" }}>
                  Ad Spend
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                  {/* Total card */}
                  <div style={{ background: "white", borderRadius: "18px", border: "none", padding: "14px 16px", borderLeft: "3px solid #0F172A" }}>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "#86868B", margin: "0 0 4px", textTransform: "uppercase" }}>Total Spend</p>
                    <p style={{ fontSize: "24px", fontWeight: 600, color: "#1D1D1F", margin: 0, lineHeight: 1 }}>
                      £{adSpendTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  {/* Per platform */}
                  {adSpend.filter((p) => p.spend > 0).map((p) => (
                    <div key={p.name} style={{ background: "white", borderRadius: "18px", border: "none", padding: "14px 16px", borderLeft: `3px solid ${p.colour}` }}>
                      <p style={{ fontSize: "10px", fontWeight: 600, color: "#86868B", margin: "0 0 4px", textTransform: "uppercase" }}>{p.name}</p>
                      <p style={{ fontSize: "24px", fontWeight: 600, color: "#1D1D1F", margin: 0, lineHeight: 1 }}>
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
              </div>
            )}

            {/* === CHART + LIFECYCLE STAGES side by side === */}
            <div>
            <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: "0 0 10px" }}>
              Trends & Lifecycle
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* CHART with pill buttons — full width bar chart */}
              {(() => {
                const metrics = [
                  { key: "contacts", label: "Contacts", colour: "#6366F1" },
                  { key: "prospects", label: "Prospects", colour: "#F59E0B" },
                  { key: "leads", label: "Leads", colour: "#0071E3" },
                  { key: "visits", label: "Home Visits", colour: "#10B981" },
                  { key: "visitors", label: "Visitors", colour: "#8B5CF6" },
                ];
                const active = metrics.find((m) => m.key === selectedMetric) ?? metrics[0];

                return (
                  <div style={{ background: "white", borderRadius: "18px", border: "none", padding: "14px", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ display: "flex", gap: "2px", background: "#F5F5F7", borderRadius: "8px", padding: "3px" }}>
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
                      <p style={{ fontSize: "11px", color: "#AEAEB2", margin: 0 }}>
                        {timelineData.reduce((s, d) => s + d.count, 0).toLocaleString()} total
                      </p>
                    </div>
                    {timelineLoading && (
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 2, background: "rgba(255,255,255,0.85)", borderRadius: "18px", padding: "12px 24px" }}>
                        <p style={{ fontSize: "13px", color: "#86868B", margin: 0, fontWeight: 600 }}>Loading...</p>
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
                              contentStyle={{ borderRadius: "18px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px" }}
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
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#AEAEB2", fontSize: "13px" }}>
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
                    <div style={{ background: "white", borderRadius: "18px", border: "none", padding: "14px", display: "flex", flexDirection: "column", flex: 1, minHeight: "240px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 600, color: "#86868B", margin: 0 }}>
                          Visit Conversion by Day
                        </p>
                        <span style={{ fontSize: "10px", color: "#AEAEB2", fontWeight: 600 }}>% that book a visit</span>
                      </div>
                      <p style={{ fontSize: "11px", color: "#86868B", margin: "0 0 10px", lineHeight: 1.4 }}>
                        Showing <strong style={{ color: "#1D1D1F" }}>{segLabel}</strong>. The percentage of contacts entering on each day who go on to book a home visit.
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
                            color: "#1D1D1F",
                            background: "#FAFAFA",
                            border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
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
                          <p style={{ fontSize: "10px", color: "#047857", margin: 0, fontWeight: 600 }}>Weekday</p>
                          <p style={{ fontSize: "20px", fontWeight: 600, color: "#059669", margin: "2px 0 0", lineHeight: 1.1 }}>{wdRate.toFixed(1)}%</p>
                          <p style={{ fontSize: "10px", color: "#86868B", margin: "2px 0 0" }}>{wdVisits} of {wdContacts}</p>
                        </div>
                        <div style={{ background: weRate < wdRate ? "#FEF2F2" : "#ECFDF5", border: `1px solid ${weRate < wdRate ? "#FECACA" : "#A7F3D0"}`, borderRadius: "8px", padding: "8px 10px" }}>
                          <p style={{ fontSize: "10px", color: weRate < wdRate ? "#B91C1C" : "#047857", margin: 0, fontWeight: 600 }}>Weekend</p>
                          <p style={{ fontSize: "20px", fontWeight: 600, color: weRate < wdRate ? "#DC2626" : "#059669", margin: "2px 0 0", lineHeight: 1.1 }}>{weRate.toFixed(1)}%</p>
                          <p style={{ fontSize: "10px", color: "#86868B", margin: "2px 0 0" }}>{weVisits} of {weContacts}</p>
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
                                  <span style={{ fontSize: "10px", fontWeight: 600, color: isBest ? "#059669" : "#0F172A", marginBottom: "2px" }}>
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
                <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: "0 0 10px" }}>
                  Site Visits
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "10px" }}>
                  {/* In-period: progress ring with booked + cancelled */}
                  {(() => {
                    const visitGoal = proratedGoal(goals.visitsGoalPerMonth) ?? siteVisits.inPeriod;
                    const pctFill = visitGoal > 0 ? Math.min((siteVisits.inPeriod / visitGoal) * 100, 100) : 0;
                    const hit = visitGoal > 0 && siteVisits.inPeriod >= visitGoal;
                    const ringColour = hit ? "#10B981" : "#0071E3";
                    const ringSize = 120;
                    const strokeW = 7;
                    const r = (ringSize - strokeW) / 2;
                    const circ = 2 * Math.PI * r;
                    const dashOff = circ - (pctFill / 100) * circ;
                    return (
                      <div onClick={() => setVisitListModal({ title: "Site Visits — Booked In Period", from, to, mode: "booked" })} style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", cursor: "pointer", transition: "box-shadow 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)")} onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)")}>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>Booked In Period</p>

                        {/* Progress ring */}
                        <div style={{ position: "relative", width: `${ringSize}px`, height: `${ringSize}px` }}>
                          <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
                            <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="#F5F5F7" strokeWidth={strokeW} />
                            <circle
                              cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none"
                              stroke={ringColour}
                              strokeWidth={strokeW}
                              strokeLinecap="round"
                              strokeDasharray={circ}
                              strokeDashoffset={dashOff}
                              style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)" }}
                            />
                          </svg>
                          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: "32px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>
                              {siteVisits.inPeriod}
                            </span>
                            {visitGoal > 0 && (
                              <span style={{ fontSize: "10px", color: "#AEAEB2", marginTop: "2px" }}>/ {visitGoal}</span>
                            )}
                          </div>
                        </div>

                        {hit ? (
                          <span style={{ fontSize: "10px", fontWeight: 500, color: "#059669", background: "#F0FDF4", borderRadius: "6px", padding: "3px 10px" }}>
                            Goal met
                          </span>
                        ) : visitGoal > 0 ? (
                          <span style={{ fontSize: "10px", fontWeight: 500, color: "#0071E3", background: "#EFF6FF", borderRadius: "6px", padding: "3px 10px" }}>
                            {visitGoal - siteVisits.inPeriod} more needed
                          </span>
                        ) : null}

                        {siteVisits.cancelled > 0 && (
                          <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)", paddingTop: "10px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#DC2626" strokeWidth="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/></svg>
                            <span style={{ fontSize: "16px", fontWeight: 600, color: "#DC2626" }}>{siteVisits.cancelled}</span>
                            <span style={{ fontSize: "11px", color: "#AEAEB2" }}>cancelled</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 4-week forward calendar — independent of selected date range */}
                  <div style={{ background: "white", borderRadius: "18px", border: "none", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 600, color: "#86868B", margin: 0 }}>
                        Upcoming Calendar
                      </p>
                      <span style={{ fontSize: "10px", color: "#AEAEB2", fontWeight: 600 }}>
                        Independent of date range
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                      {siteVisits.upcoming.map((wk, i) => {
                        const colours = ["#0071E3", "#6366F1", "#8B5CF6", "#A855F7"];
                        const colour = colours[i] ?? "#0071E3";
                        const goal = goals.siteVisitsGoalPerWeek ?? 10;
                        const pctFill = Math.min((wk.count / goal) * 100, 100);
                        const hit = wk.count >= goal;
                        const ringColour = hit ? "#10B981" : colour;
                        const ringSize = 100;
                        const strokeWidth = 6;
                        const radius = (ringSize - strokeWidth) / 2;
                        const circumference = 2 * Math.PI * radius;
                        const dashOffset = circumference - (pctFill / 100) * circumference;
                        const fmtDay = (s: string) => {
                          const [, m, d] = s.split("-");
                          return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
                        };
                        return (
                          <div
                            key={wk.label}
                            onClick={() => setVisitListModal({ title: `Site Visits — ${wk.label}`, from: wk.weekStart, to: wk.weekEnd, mode: "scheduled" })}
                            style={{
                              background: "white",
                              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                              borderRadius: "20px",
                              padding: "20px 12px",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              textAlign: "center",
                              gap: "4px",
                              cursor: "pointer",
                              transition: "box-shadow 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)")}
                          >
                            {/* Progress ring */}
                            <div style={{ position: "relative", width: `${ringSize}px`, height: `${ringSize}px`, marginBottom: "4px" }}>
                              <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
                                <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="#F5F5F7" strokeWidth={strokeWidth} />
                                <circle
                                  cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none"
                                  stroke={ringColour}
                                  strokeWidth={strokeWidth}
                                  strokeLinecap="round"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={dashOffset}
                                  style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)" }}
                                />
                              </svg>
                              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: "28px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>
                                  {wk.count}
                                </span>
                                <span style={{ fontSize: "9px", color: "#AEAEB2", marginTop: "2px" }}>/ {goal}</span>
                              </div>
                            </div>

                            <p style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>
                              {wk.label}
                            </p>
                            <p style={{ fontSize: "10px", color: "#AEAEB2", margin: 0 }}>
                              {fmtDay(wk.weekStart)} – {fmtDay(wk.weekEnd)}
                            </p>
                            {hit && (
                              <span style={{ fontSize: "9px", fontWeight: 500, color: "#059669", background: "#F0FDF4", borderRadius: "6px", padding: "2px 8px", marginTop: "2px" }}>
                                Goal met
                              </span>
                            )}
                            {!hit && wk.count > 0 && (
                              <span style={{ fontSize: "9px", fontWeight: 500, color: colour, background: `${colour}10`, borderRadius: "6px", padding: "2px 8px", marginTop: "2px" }}>
                                {goal - wk.count} more needed
                              </span>
                            )}
                            {wk.cancelled > 0 && (
                              <span style={{ fontSize: "9px", fontWeight: 500, color: "#DC2626", background: "#FEF2F2", borderRadius: "6px", padding: "2px 8px", marginTop: "2px" }}>
                                {wk.cancelled} cancelled
                              </span>
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
                    <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "20px", marginTop: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>
                          Salesman Workload
                        </p>
                        <span style={{ fontSize: "10px", color: "#AEAEB2" }}>
                          Weekly targets
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "80px repeat(4, 1fr)", gap: "8px 10px", alignItems: "center" }}>
                        {/* Header row */}
                        <div />
                        {siteVisits.upcoming.map((wk) => (
                          <div key={wk.label} style={{ fontSize: "11px", fontWeight: 500, color: "#86868B", textAlign: "center" }}>
                            {wk.label}
                          </div>
                        ))}
                        {/* Rows */}
                        {SALESMEN.map((name) => {
                          const goal = SALESMAN_GOALS[name] ?? 10;
                          return (
                            <React.Fragment key={name}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F" }}>{name}</div>
                              {siteVisits.upcoming.map((wk) => {
                                const n = wk.bySalesman?.[name] ?? 0;
                                const pctFill = Math.min((n / goal) * 100, 100);
                                const hit = n >= goal;
                                const ringCol = hit ? "#10B981" : n >= goal * 0.5 ? "#F59E0B" : n > 0 ? "#0071E3" : "#E5E5EA";
                                const rs = 44;
                                const sw = 3;
                                const r = (rs - sw) / 2;
                                const circ = 2 * Math.PI * r;
                                const dashOff = circ - (pctFill / 100) * circ;
                                return (
                                  <div key={`${name}-${wk.label}`} onClick={() => n > 0 && setVisitListModal({ title: `${name} — ${wk.label}`, from: wk.weekStart, to: wk.weekEnd, mode: "scheduled", salesman: name })} style={{ display: "flex", justifyContent: "center", cursor: n > 0 ? "pointer" : undefined, borderRadius: "12px", transition: "background 0.15s" }} onMouseEnter={(e) => { if (n > 0) e.currentTarget.style.background = "#F5F5F7"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                                    <div style={{ position: "relative", width: `${rs}px`, height: `${rs}px` }}>
                                      <svg width={rs} height={rs} style={{ transform: "rotate(-90deg)" }}>
                                        <circle cx={rs / 2} cy={rs / 2} r={r} fill="none" stroke="#F5F5F7" strokeWidth={sw} />
                                        <circle cx={rs / 2} cy={rs / 2} r={r} fill="none" stroke={ringCol} strokeWidth={sw} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOff} style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.25,0.1,0.25,1)" }} />
                                      </svg>
                                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ fontSize: "13px", fontWeight: 600, color: n > 0 ? "#1D1D1F" : "#D2D2D7", lineHeight: 1 }}>{n}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* === INSTALLS — 3 month forward calendar (deals: installation_date) === */}
            {!isSourceFiltered && installs && installs.months.length > 0 && (
              <div>
                <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: "0 0 10px" }}>
                  Installs
                </h2>
                <div style={{ background: "white", borderRadius: "18px", border: "none", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#86868B", margin: 0 }}>
                      Upcoming Installs
                    </p>
                    <span style={{ fontSize: "10px", color: "#AEAEB2", fontWeight: 600 }}>
                      Independent of date range · Excludes lost deals
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                    {installs.months.map((mo, i) => {
                      const colours = ["#7C3AED", "#9333EA", "#A855F7"];
                      const colour = colours[i] ?? "#7C3AED";
                      const goal = goals.installsGoalPerMonth ?? 0;
                      const pctFill = goal > 0 ? Math.min((mo.count / goal) * 100, 100) : 0;
                      const hit = goal > 0 && mo.count >= goal;
                      const ringColour = hit ? "#10B981" : colour;
                      const ringSize = 100;
                      const sw = 6;
                      const r = (ringSize - sw) / 2;
                      const circ = 2 * Math.PI * r;
                      const dashOff = circ - (pctFill / 100) * circ;
                      // Compute month date range for the modal
                      const moIdx = ["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(mo.monthName);
                      const moFrom = `${mo.year}-${String(moIdx + 1).padStart(2, "0")}-01`;
                      const lastDay = new Date(mo.year, moIdx + 1, 0).getDate();
                      const moTo = `${mo.year}-${String(moIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                      return (
                        <div
                          key={mo.key}
                          onClick={() => setInstallListModal({ title: `Installs — ${mo.monthName} ${mo.year}`, from: moFrom, to: moTo })}
                          style={{
                            background: "white",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                            borderRadius: "20px",
                            padding: "20px 12px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                            gap: "4px",
                            cursor: "pointer",
                            transition: "box-shadow 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)")}
                        >
                          {/* Progress ring */}
                          <div style={{ position: "relative", width: `${ringSize}px`, height: `${ringSize}px`, marginBottom: "4px" }}>
                            <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
                              <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="#F5F5F7" strokeWidth={sw} />
                              <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke={ringColour} strokeWidth={sw} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOff} style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.25,0.1,0.25,1)" }} />
                            </svg>
                            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: "28px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>{mo.count}</span>
                              {goal > 0 && <span style={{ fontSize: "9px", color: "#AEAEB2", marginTop: "2px" }}>/ {goal}</span>}
                            </div>
                          </div>

                          <p style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>
                            {mo.monthName} {mo.year}
                          </p>
                          {hit && (
                            <span style={{ fontSize: "9px", fontWeight: 500, color: "#059669", background: "#F0FDF4", borderRadius: "6px", padding: "2px 8px" }}>
                              Goal met (+{mo.count - goal})
                            </span>
                          )}
                          {goal > 0 && !hit && (
                            <span style={{ fontSize: "9px", fontWeight: 500, color: colour, background: `${colour}10`, borderRadius: "6px", padding: "2px 8px" }}>
                              {goal - mo.count} more needed
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* === INITIAL OUTREACH FEEDBACK — donut + detail === */}
            {!isSourceFiltered && outreachFeedback && outreachFeedback.feedback.length > 0 && (() => {
              const feedbackColour = (label: string): string => {
                const l = label.toLowerCase();
                if (l.includes("home visit booked")) return "#10B981";
                if (l.includes("grant")) return "#10B981";
                if (l.includes("discussing with family")) return "#0071E3";
                if (l.includes("timing") || l.includes("not yet ready")) return "#0071E3";
                if (l.includes("brochure only")) return "#F59E0B";
                if (l.includes("too expensive")) return "#F59E0B";
                if (l.includes("competitor")) return "#F59E0B";
                if (l.includes("part fitting") || l.includes("supply only") || l.includes("flooring")) return "#94A3B8";
                if (l.includes("not answering")) return "#DC2626";
                if (l.includes("wrong contact")) return "#DC2626";
                if (l.includes("time wasters")) return "#DC2626";
                if (l.includes("doesn't know") || l.includes("didn't know")) return "#DC2626";
                return "#94A3B8";
              };
              const chartData = outreachFeedback.feedback.map((f) => ({
                name: f.label,
                feedbackValue: f.value,
                value: f.count,
                fill: feedbackColour(f.label),
                bySource: f.bySource,
                byAction: f.byAction,
              }));
              // Group into positive / neutral / negative
              const positive = chartData.filter((d) => ["#10B981"].includes(d.fill));
              const neutral = chartData.filter((d) => ["#0071E3", "#F59E0B"].includes(d.fill));
              const negative = chartData.filter((d) => ["#DC2626", "#94A3B8"].includes(d.fill));
              const positiveTotal = positive.reduce((s, d) => s + d.value, 0);
              const negativeTotal = negative.reduce((s, d) => s + d.value, 0);
              const neutralTotal = neutral.reduce((s, d) => s + d.value, 0);

              return (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
                    <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>
                      Outreach Feedback
                    </h2>
                    <span style={{ fontSize: "10px", color: "#AEAEB2" }}>
                      {outreachFeedback.total} calls
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "12px" }}>
                    {/* Donut chart */}
                    <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: "200px", height: "200px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              strokeWidth={2}
                              stroke="#fff"
                            >
                              {chartData.map((d, i) => (
                                <Cell key={i} fill={d.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Summary badges */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#059669", background: "#F0FDF4", borderRadius: "8px", padding: "4px 10px" }}>
                          {positiveTotal} positive
                        </span>
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#0071E3", background: "#EFF6FF", borderRadius: "8px", padding: "4px 10px" }}>
                          {neutralTotal} maybe later
                        </span>
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#DC2626", background: "#FEF2F2", borderRadius: "8px", padding: "4px 10px" }}>
                          {negativeTotal} lost
                        </span>
                      </div>
                    </div>

                    {/* Detail list */}
                    <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {chartData.map((f) => {
                        const pct = outreachFeedback.total > 0 ? Math.round((f.value / outreachFeedback.total) * 100) : 0;
                        const top3 = [...f.bySource.slice(0, 2), ...f.byAction.slice(0, 2)]
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 3);
                        return (
                          <div key={f.name} onClick={() => setFeedbackListModal({ title: `Feedback — ${f.name}`, feedback: f.feedbackValue })} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", borderRadius: "10px", padding: "4px 0", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: f.fill, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F" }}>{f.name}</span>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                  <span style={{ fontSize: "10px", color: "#AEAEB2" }}>{pct}%</span>
                                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>{f.value}</span>
                                </div>
                              </div>
                              {top3.length > 0 && (
                                <p style={{ fontSize: "10px", color: "#86868B", margin: "2px 0 0" }}>
                                  {top3.map((s, i) => (
                                    <span key={i}>
                                      {i > 0 && <span style={{ color: "#D2D2D7" }}> · </span>}
                                      {s.label} <strong style={{ color: "#3A3A3C" }}>{s.count}</strong>
                                    </span>
                                  ))}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* By-source breakdown: stacked bars per source */}
                  {(() => {
                    // Build source → { feedback: count } map
                    const sourceMap = new Map<string, { sourceValue: string; total: number; feedbacks: { label: string; count: number; colour: string }[] }>();
                    for (const f of outreachFeedback.feedback) {
                      for (const s of f.bySource) {
                        let entry = sourceMap.get(s.label);
                        if (!entry) { entry = { sourceValue: s.value, total: 0, feedbacks: [] }; sourceMap.set(s.label, entry); }
                        entry.total += s.count;
                        entry.feedbacks.push({ label: f.label, count: s.count, colour: feedbackColour(f.label) });
                      }
                    }
                    const sources = [...sourceMap.entries()]
                      .map(([name, data]) => ({ name, ...data }))
                      .sort((a, b) => b.total - a.total);
                    if (sources.length === 0) return null;
                    const maxTotal = sources[0].total;

                    return (
                      <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "20px", marginTop: "12px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 600, color: "#86868B", margin: "0 0 14px" }}>
                          Feedback by Lead Source
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {sources.map((src) => {
                            const positiveCount = src.feedbacks.filter((f) => f.colour === "#10B981").reduce((s, f) => s + f.count, 0);
                            const positivePct = src.total > 0 ? Math.round((positiveCount / src.total) * 100) : 0;
                            return (
                              <div key={src.name} onClick={() => setFeedbackListModal({ title: `Feedback — ${src.name}`, source: src.sourceValue })} style={{ cursor: "pointer", borderRadius: "10px", padding: "6px 8px", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F" }}>{src.name}</span>
                                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                    <span style={{
                                      fontSize: "9px",
                                      fontWeight: 500,
                                      color: positivePct >= 40 ? "#059669" : positivePct >= 20 ? "#F59E0B" : "#DC2626",
                                      background: positivePct >= 40 ? "#F0FDF4" : positivePct >= 20 ? "#FFFBEB" : "#FEF2F2",
                                      borderRadius: "4px",
                                      padding: "1px 6px",
                                    }}>
                                      {positivePct}% positive
                                    </span>
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>{src.total}</span>
                                  </div>
                                </div>
                                {/* Stacked bar */}
                                <div style={{ display: "flex", height: "8px", borderRadius: "999px", overflow: "hidden", background: "#F5F5F7" }}>
                                  {src.feedbacks.map((f, fi) => (
                                    <div key={fi} title={`${f.label}: ${f.count}`} style={{ width: `${(f.count / maxTotal) * 100}%`, background: f.colour, transition: "width 0.3s" }} />
                                  ))}
                                </div>
                                {/* Top feedbacks inline */}
                                <p style={{ fontSize: "10px", color: "#86868B", margin: "3px 0 0" }}>
                                  {src.feedbacks.slice(0, 3).map((f, i) => (
                                    <span key={i}>
                                      {i > 0 && <span style={{ color: "#D2D2D7" }}> · </span>}
                                      <span style={{ color: f.colour === "#10B981" ? "#059669" : f.colour === "#DC2626" ? "#DC2626" : "#86868B" }}>{f.label}</span>{" "}
                                      <strong style={{ color: "#3A3A3C" }}>{f.count}</strong>
                                    </span>
                                  ))}
                                </p>
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
              // Conversion rate per touchpoint: of contacts who had this touchpoint, how many reached Home Visit or Won?
              const tpTotal = new Map<string, number>();
              const tpConverted = new Map<string, number>();
              for (const cj of filtered) {
                const interactions = cj.steps.filter(isInteraction);
                const converted = cj.steps.some((s) => s === "Home Visit" || s === "Won");
                const seen = new Set<string>();
                for (const step of interactions) {
                  if (seen.has(step)) continue;
                  seen.add(step);
                  tpTotal.set(step, (tpTotal.get(step) ?? 0) + 1);
                  if (converted) tpConverted.set(step, (tpConverted.get(step) ?? 0) + 1);
                }
              }

              const allTouchpoints = new Set([...attrFirst.keys(), ...attrMid.keys(), ...attrLast.keys()]);
              const attrData = [...allTouchpoints].map((name) => {
                const f = attrFirst.get(name) ?? 0;
                const m = attrMid.get(name) ?? 0;
                const l = attrLast.get(name) ?? 0;
                const total = f + m + l;
                const contacts = tpTotal.get(name) ?? 0;
                const converted = tpConverted.get(name) ?? 0;
                const convRate = contacts > 0 ? Math.round((converted / contacts) * 100) : 0;
                return { name, first: f, mid: m, last: l, total, convRate };
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
                if (step === "We Emailed") return "#0071E3";
                if (step === "They Emailed") return "#06B6D4";
                if (step.startsWith("Waiting")) return "#F97316";
                return "#8B5CF6";
              };

              const pillStyle = (active: boolean): React.CSSProperties => ({
                fontSize: "10px",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: "20px",
                border: active ? "1px solid #0071E3" : "1px solid rgba(0,0,0,0.06)",
                background: active ? "#EFF6FF" : "white",
                color: active ? "#0071E3" : "#64748B",
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
                        <div key={i} onClick={() => setJourneyListModal({ path: j.path })} style={{ cursor: "pointer", borderRadius: "10px", padding: "6px 8px", margin: "-6px -8px", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", flex: 1, minWidth: 0 }}>
                              {j.steps.map((step, si) => (
                                <span key={si} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  {si > 0 && <span style={{ color: "#D2D2D7", fontSize: "11px", fontWeight: 600 }}>→</span>}
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
                            <span style={{ fontSize: "14px", fontWeight: 600, color: "#1D1D1F", marginLeft: "12px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              {j.count}
                            </span>
                          </div>
                          <div style={{ background: "#F5F5F7", borderRadius: "3px", height: "3px", overflow: "hidden" }}>
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
                          color: "#0071E3",
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
                    <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: 0 }}>
                      Customer Journeys
                    </h2>
                    {(() => {
                      const newCount = filtered.filter((cj) => cj.createdInPeriod).length;
                      const returning = filtered.length - newCount;
                      return (
                        <span style={{ fontSize: "10px", color: "#AEAEB2" }}>
                          {filtered.length} total ({newCount} new{returning > 0 ? ` + ${returning} returning` : ""})
                        </span>
                      );
                    })()}
                  </div>

                  {/* Filters — compact dropdowns */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    {[
                      { label: "Source", value: journeyFilterSource, setter: setJourneyFilterSource, options: customerJourneys.filters.leadSources },
                      { label: "Action", value: journeyFilterAction, setter: setJourneyFilterAction, options: customerJourneys.filters.conversionActions },
                      { label: "Form", value: journeyFilterForm, setter: setJourneyFilterForm, options: customerJourneys.filters.forms },
                    ].map((f) => (
                      <select
                        key={f.label}
                        value={f.value ?? ""}
                        onChange={(e) => { f.setter(e.target.value || null); setJourneyShowVisit(10); setJourneyShowNoVisit(10); }}
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: f.value ? "#0071E3" : "#86868B",
                          background: f.value ? "#EFF6FF" : "#F5F5F7",
                          border: f.value ? "1px solid #0071E3" : "1px solid rgba(0,0,0,0.06)",
                          borderRadius: "10px",
                          padding: "6px 12px",
                          cursor: "pointer",
                          outline: "none",
                          appearance: "none",
                          WebkitAppearance: "none",
                          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386868B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 10px center",
                          paddingRight: "28px",
                        }}
                      >
                        <option value="">All {f.label}s</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ))}
                    {isFiltered && (
                      <button type="button" onClick={() => { setJourneyFilterSource(null); setJourneyFilterAction(null); setJourneyFilterForm(null); setJourneyShowVisit(10); setJourneyShowNoVisit(10); }}
                        style={{ fontSize: "11px", fontWeight: 500, color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}>
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Summary cards row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
                    <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div>
                        <span style={{ fontSize: "22px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>{withVisitTotal}</span>
                        <p style={{ fontSize: "11px", color: "#86868B", margin: "2px 0 0" }}>Reached Home Visit</p>
                      </div>
                    </div>
                    <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="2"/><path d="M12 8v4l3 3" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/></svg>
                      </div>
                      <div>
                        <span style={{ fontSize: "22px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>{withoutVisitTotal}</span>
                        <p style={{ fontSize: "11px", color: "#86868B", margin: "2px 0 0" }}>Still in progress</p>
                      </div>
                    </div>
                    <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div>
                        <span style={{ fontSize: "22px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>{filtered.length > 0 ? Math.round((withVisitTotal / filtered.length) * 100) : 0}%</span>
                        <p style={{ fontSize: "11px", color: "#86868B", margin: "2px 0 0" }}>Conversion rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Touchpoint attribution — with bars + load more */}
                  {attrData.length > 0 && (() => {
                    const convRateColour = (rate: number): string => {
                      if (rate >= 30) return "#059669";
                      if (rate >= 15) return "#F59E0B";
                      return "#DC2626";
                    };
                    const allFirst = [...attrData].filter((t) => t.first > 0).sort((a, b) => b.first - a.first);
                    const allMid = [...attrData].filter((t) => t.mid > 0).sort((a, b) => b.mid - a.mid);
                    const allLast = [...attrData].filter((t) => t.last > 0).sort((a, b) => b.last - a.last);
                    const firstSorted = allFirst.slice(0, attrShowCount);
                    const midSorted = allMid.slice(0, attrShowCount);
                    const lastSorted = allLast.slice(0, attrShowCount);
                    const hasMore = allFirst.length > attrShowCount || allMid.length > attrShowCount || allLast.length > attrShowCount;

                    const renderCompact = (items: typeof attrData, field: "first" | "mid" | "last", colour: string) => {
                      const maxVal = items.length > 0 ? items[0][field] : 1;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {items.map((t) => (
                            <div key={t.name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "11px", color: "#3A3A3C", width: "100px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.name}>{t.name}</span>
                              <div style={{ flex: 1, background: "#F5F5F7", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                                <div style={{ width: `${(t[field] / maxVal) * 100}%`, height: "100%", background: colour, borderRadius: "999px", transition: "width 0.3s", minWidth: t[field] > 0 ? "2px" : "0" }} />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 600, color: "#1D1D1F", width: "22px", textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{t[field]}</span>
                              <span title={`${t.convRate}% converted`} style={{ fontSize: "9px", fontWeight: 500, color: convRateColour(t.convRate), background: `${convRateColour(t.convRate)}12`, borderRadius: "4px", padding: "1px 5px", width: "28px", textAlign: "center", flexShrink: 0 }}>{t.convRate}%</span>
                            </div>
                          ))}
                        </div>
                      );
                    };

                    return (
                      <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "20px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>Touchpoint Attribution</p>
                          <span style={{ fontSize: "9px", color: "#AEAEB2" }}>% = converted to Home Visit or Won</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                          <div>
                            <p style={{ fontSize: "10px", fontWeight: 500, color: "#8B5CF6", margin: "0 0 8px" }}>First touch</p>
                            {renderCompact(firstSorted, "first", "#8B5CF6")}
                          </div>
                          <div>
                            <p style={{ fontSize: "10px", fontWeight: 500, color: "#86868B", margin: "0 0 8px" }}>Mid touch</p>
                            {renderCompact(midSorted, "mid", "#94A3B8")}
                          </div>
                          <div>
                            <p style={{ fontSize: "10px", fontWeight: 500, color: "#0EA5E9", margin: "0 0 8px" }}>Last touch</p>
                            {renderCompact(lastSorted, "last", "#0EA5E9")}
                          </div>
                        </div>
                        {hasMore && (
                          <div style={{ textAlign: "center", marginTop: "12px" }}>
                            <button type="button" onClick={() => setAttrShowCount((n) => n + 5)}
                              style={{ fontSize: "11px", fontWeight: 500, color: "#0071E3", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "6px 14px", cursor: "pointer" }}>
                              Show more
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Journey paths — two columns */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F" }}>Converted</span>
                        <span style={{ fontSize: "12px", color: "#AEAEB2", marginLeft: "auto" }}>{withVisitTotal}</span>
                      </div>
                      {withVisit.length > 0 ? renderJourneyList(withVisit, "#10B981", journeyShowVisit, () => setJourneyShowVisit((n) => n + 10)) : (
                        <p style={{ fontSize: "12px", color: "#AEAEB2", margin: 0 }}>None{isFiltered ? " matching filters" : " in this period"}</p>
                      )}
                    </div>
                    <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8B5CF6" }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F" }}>In progress</span>
                        <span style={{ fontSize: "12px", color: "#AEAEB2", marginLeft: "auto" }}>{withoutVisitTotal}</span>
                      </div>
                      {withoutVisit.length > 0 ? renderJourneyList(withoutVisit, "#8B5CF6", journeyShowNoVisit, () => setJourneyShowNoVisit((n) => n + 10)) : (
                        <p style={{ fontSize: "12px", color: "#AEAEB2", margin: 0 }}>None{isFiltered ? " matching filters" : " in this period"}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* === REVIEWS + SOCIAL === */}
            {(() => {
              const hasReviews = reviews.length > 0 && reviews.some((r) => r.total > 0);
              const hasSocial = social.length > 0 && social.some((s) => s.total > 0);
              if (!hasReviews && !hasSocial) return null;

              const PLATFORM_LOGOS: Record<string, React.ReactNode> = {
                Trustpilot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#00B67A"/></svg>,
                Google: <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
                "Reviews.io": <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#5B2D8E"/></svg>,
                Facebook: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#1877F2"/></svg>,
                YouTube: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="#FF0000"/><path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#fff"/></svg>,
                Instagram: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="ig" x1="0" y1="24" x2="24" y2="0"><stop offset="0%" stopColor="#ffd600"/><stop offset="50%" stopColor="#ff0069"/><stop offset="100%" stopColor="#d300c5"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig)" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="5" stroke="url(#ig)" strokeWidth="2" fill="none"/><circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig)"/></svg>,
                Twitter: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#1D1D1F"/></svg>,
                LinkedIn: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2"/></svg>,
                TikTok: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.3 0 .59.05.86.13V9.01a6.32 6.32 0 00-.86-.06 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.77 1.52V6.84a4.84 4.84 0 01-1.01-.15z" fill="#1D1D1F"/></svg>,
              };

              const allItems = [
                ...reviews.filter((r) => r.total > 0).map((r) => ({ type: "review" as const, name: r.name, url: r.url, colour: r.colour, total: r.total, rating: r.rating, increase: r.increase })),
                ...social.filter((s) => s.total > 0).map((s) => ({ type: "social" as const, name: s.name, url: s.url, colour: s.colour, total: s.total, rating: 0, increase: s.increase })),
              ];

              return (
            <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>
                Reviews & Social
              </h2>
              <div style={{ display: "flex", gap: "12px" }}>
                {hasReviews && <span style={{ fontSize: "11px", color: "#AEAEB2" }}><strong style={{ color: "#1D1D1F" }}>{reviewsTotal.toLocaleString()}</strong> reviews</span>}
                {hasSocial && <span style={{ fontSize: "11px", color: "#AEAEB2" }}><strong style={{ color: "#1D1D1F" }}>{socialTotal.toLocaleString()}</strong> followers</span>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(allItems.length, 6)}, 1fr)`, gap: "10px" }}>
              {allItems.map((item) => (
                <a key={item.name} href={item.url || undefined} target="_blank" rel="noopener noreferrer"
                  style={{
                    textDecoration: "none",
                    background: "white",
                    borderRadius: "20px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                    padding: "18px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    textAlign: "center",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                >
                  {/* Logo */}
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#F5F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {PLATFORM_LOGOS[item.name] ?? <span style={{ fontSize: "16px", fontWeight: 600, color: item.colour }}>{item.name[0]}</span>}
                  </div>
                  {/* Name */}
                  <span style={{ fontSize: "11px", fontWeight: 500, color: "#86868B" }}>{item.name}</span>
                  {/* Number */}
                  <span style={{ fontSize: "22px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>{item.total.toLocaleString()}</span>
                  {/* Rating or type */}
                  {item.rating > 0 ? (
                    <span style={{ fontSize: "10px", fontWeight: 500, color: "#F59E0B" }}>★ {item.rating}</span>
                  ) : (
                    <span style={{ fontSize: "10px", color: "#AEAEB2" }}>{item.type === "review" ? "reviews" : "followers"}</span>
                  )}
                  {/* Increase badge */}
                  {item.increase !== null && item.increase > 0 && (
                    <span style={{ fontSize: "9px", fontWeight: 500, color: "#059669", background: "#F0FDF4", borderRadius: "6px", padding: "2px 8px" }}>
                      +{item.increase.toLocaleString()}
                    </span>
                  )}
                </a>
              ))}
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
          borderRadius: "20px",
          padding: "12px 20px",
          fontSize: "13px",
          fontWeight: 600,
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
            background: "#FAFAFA",
            boxShadow: "-8px 0 30px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            animation: "slideIn 0.25s ease",
          }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>AI Marketing Insights</h2>
                <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "2px 0 0" }}>Powered by Claude</p>
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
                  style={{ background: "#F5F5F7", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px", color: "#86868B", display: "flex", alignItems: "center", justifyContent: "center" }}
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
                  <p style={{ fontSize: "13px", color: "#86868B", margin: 0 }}>Analysing your marketing data...</p>
                </div>
              )}
              {!aiLoading && aiInsights.map((insight, i) => {
                if (aiDismissed.has(i)) return null;
                // Split on ** for bold parts
                const parts = insight.split(/\*\*(.*?)\*\*/);
                return (
                  <div key={i} style={{
                    background: "white",
                    borderRadius: "18px",
                    border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}>
                    <div style={{ fontSize: "13px", color: "#3A3A3C", lineHeight: 1.6 }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#8B5CF6", background: "#F5F3FF", borderRadius: "4px", padding: "2px 6px", marginRight: "8px" }}>
                        {i + 1}
                      </span>
                      {parts.map((part, j) =>
                        j % 2 === 1
                          ? <strong key={j} style={{ color: "#1D1D1F" }}>{part}</strong>
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
                          color: "#86868B",
                          background: "#FAFAFA",
                          border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
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
                          style={{ flex: 1, fontSize: "12px", border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", borderRadius: "6px", padding: "6px 10px", background: "#FAFAFA" }}
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
                <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {aiChatMessages.map((msg, i) => (
                    <div key={i} style={{
                      background: msg.role === "user" ? "#EFF6FF" : "white",
                      border: `1px solid ${msg.role === "user" ? "#BFDBFE" : "#E2E8F0"}`,
                      borderRadius: "18px",
                      padding: "10px 14px",
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "90%",
                    }}>
                      <p style={{ fontSize: "12px", color: "#3A3A3C", margin: 0, lineHeight: 1.5 }}>{msg.text}</p>
                    </div>
                  ))}
                  {aiChatLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px" }}>
                      <div style={{ width: "12px", height: "12px", border: "2px solid #E2E8F0", borderTop: "2px solid #8B5CF6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: "11px", color: "#AEAEB2" }}>Thinking...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat input */}
            <div style={{ padding: "12px 24px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "white" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Ask about your data..."
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !aiChatLoading) sendAiChat(); }}
                  style={{ flex: 1, fontSize: "13px", border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", borderRadius: "18px", padding: "10px 14px", background: "#FAFAFA" }}
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
                    borderRadius: "18px",
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
      {contactListStage && (
        <ContactListModal
          stage={contactListStage.stage}
          colour={contactListStage.colour}
          from={from}
          to={to}
          sourceCategory={contactListStage.sourceCategory}
          onClose={() => setContactListStage(null)}
        />
      )}
      {visitListModal && (
        <SiteVisitListModal
          title={visitListModal.title}
          from={visitListModal.from}
          to={visitListModal.to}
          mode={visitListModal.mode}
          salesman={visitListModal.salesman}
          onClose={() => setVisitListModal(null)}
        />
      )}
      {installListModal && (
        <InstallListModal
          title={installListModal.title}
          from={installListModal.from}
          to={installListModal.to}
          onClose={() => setInstallListModal(null)}
        />
      )}
      {journeyListModal && customerJourneys && (() => {
        const matchingContacts = customerJourneys.contactJourneys
          .filter((cj) => cj.path === journeyListModal.path)
          .map((cj) => ({ id: cj.id, name: cj.name, email: cj.email, phone: cj.phone, leadSource: cj.leadSource, conversionAction: cj.conversionAction }));
        return (
          <JourneyListModal
            path={journeyListModal.path}
            contacts={matchingContacts}
            onClose={() => setJourneyListModal(null)}
          />
        );
      })()}
      {feedbackListModal && (
        <FeedbackListModal
          title={feedbackListModal.title}
          from={from}
          to={to}
          feedback={feedbackListModal.feedback}
          source={feedbackListModal.source}
          onClose={() => setFeedbackListModal(null)}
        />
      )}
    </div>
  );
}

/* ── Components ── */

const LIFECYCLE_COLOURS: Record<string, string> = {
  "Prospect": "#8B5CF6",
  "Warm - Prospect": "#A78BFA",
  "Lead": "#0071E3",
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
        borderRadius: "20px",
        border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        padding: "16px 20px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "#86868B", margin: 0 }}>
            Lifecycle Stages
          </p>
          <span style={{ fontSize: "10px", color: "#AEAEB2", background: "#F5F5F7", borderRadius: "6px", padding: "2px 8px", fontWeight: 500 }}>
            Live totals
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "#AEAEB2", margin: 0, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontWeight: 600, color: "#1D1D1F", fontSize: "15px" }}>{total.toLocaleString()}</span> contacts
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
                    <span style={{ fontSize: size > 72 ? "17px" : size > 60 ? "14px" : "12px", fontWeight: 600, color: colour, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {stage.count.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 600, color: `${colour}99`, lineHeight: 1 }}>
                      {pct}%
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: isLead ? 800 : 600, color: isLead ? colour : "#86868B", textAlign: "center", lineHeight: 1.2 }}>
                    {stage.label}
                  </span>
                  {hasPeriod && (
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: periodCount > 0 ? "#059669" : "#CBD5E1",
                      background: periodCount > 0 ? "#ECFDF5" : "#F8FAFC",
                      borderRadius: "18px",
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
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#AEAEB2", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
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
                    <span style={{ color: "#86868B", fontWeight: 500, fontSize: "11px", flex: 1 }}>{stage.label}</span>
                    <span style={{ fontWeight: 600, color: "#1D1D1F", fontSize: "12px", fontVariantNumeric: "tabular-nums", minWidth: "36px", textAlign: "right" }}>
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
        <p style={{ fontSize: "10px", color: "#AEAEB2", margin: "10px 0 0", textAlign: "center" }}>
          Green badges show contacts created in the selected date range
        </p>
      )}
    </div>
  );
}


const KPI_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  "Website Visitors": {
    bg: "#F3F0FF",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="#8B5CF6" strokeWidth="2"/></svg>,
  },
  "Contacts": {
    bg: "#EDE9FE",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="#6366F1" strokeWidth="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  "Prospects": {
    bg: "#FFFBEB",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  "Leads": {
    bg: "#EFF6FF",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  "Home Visits": {
    bg: "#ECFDF5",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  "Won Jobs": {
    bg: "#ECFDF5",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
};

function KpiCard({ label, value, colour, subtitle, detail, goal, comparison, liveNow, onClick }: { label: string; value: number | null; colour: string; subtitle?: string; detail?: string; goal?: { current: number; target: number }; comparison?: { current: number; previous: number }; liveNow?: number | null; onClick?: () => void }) {
  const pct = goal ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  const met = goal ? goal.current >= goal.target : false;
  const kpiIcon = KPI_ICONS[label];

  return (
    <div
      onClick={onClick}
      style={{
        background: "white",
        borderRadius: "20px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: onClick ? "pointer" : undefined,
        transition: "box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)"; }}
    >
      {/* Header: icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {kpiIcon && (
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: kpiIcon.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            {kpiIcon.icon}
          </div>
        )}
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>
          {label}
        </p>
      </div>

      {/* Big number + delta badge */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "28px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1, letterSpacing: "-0.5px" }}>
          {value !== null ? value.toLocaleString() : "—"}
        </span>
        {comparison && (() => {
          const delta = comparison.current - comparison.previous;
          const better = delta >= 0;
          return (
            <span style={{
              fontSize: "11px",
              fontWeight: 500,
              color: better ? "#059669" : "#DC2626",
              background: better ? "#F0FDF4" : "#FEF2F2",
              borderRadius: "6px",
              padding: "2px 6px",
            }}>
              {better ? "↑" : "↓"} {Math.abs(delta).toLocaleString()}
            </span>
          );
        })()}
      </div>

      {/* Live now indicator */}
      {liveNow != null && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#059669" }}>{liveNow}</span>
          <span style={{ fontSize: "11px", color: "#86868B" }}>on site now</span>
        </div>
      )}

      {/* Subtitle (e.g. cancelled visits, won value) */}
      {subtitle && (
        <p style={{
          fontSize: "12px",
          color: subtitle.includes("cancelled") ? "#DC2626" : "#AEAEB2",
          fontWeight: subtitle.includes("cancelled") ? 500 : 400,
          margin: 0,
        }}>{subtitle}</p>
      )}

      {/* Detail row (e.g. Form Leads + Direct Bookings) */}
      {detail && (
        <p style={{ fontSize: "11px", color: "#0071E3", margin: 0, fontWeight: 500 }}>{detail}</p>
      )}

      {/* Goal progress */}
      {goal && (() => {
        const pctOfPace = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
        const delta = goal.current - goal.target;
        const ahead = delta >= 0;
        return (
          <div>
            <div style={{ background: "#F5F5F7", borderRadius: "999px", height: "4px", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: "999px", background: met ? "#10B981" : colour, transition: "width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
              <span style={{ fontSize: "10px", color: "#86868B" }}>
                {goal.current} / {goal.target} · {pctOfPace.toFixed(0)}%
              </span>
              <span style={{ fontSize: "10px", fontWeight: 500, color: ahead ? "#059669" : "#DC2626" }}>
                {ahead ? "↑" : "↓"} {Math.abs(delta)} {ahead ? "ahead" : "behind"}
              </span>
            </div>
          </div>
        );
      })()}
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
  onClick,
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
  onClick?: () => void;
}) {
  const filtered = sources.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  const pct = sourcesTotal > 0 ? ((total / sourcesTotal) * 100) : 0;
  const pctStr = pct.toFixed(1);

  return (
    <div
      onClick={onClick}
      style={{
        background: "white",
        borderRadius: "18px",
        padding: "14px",
        border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: onClick ? "pointer" : undefined,
        transition: "box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)"; }}
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
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>{title}</p>
            <p style={{ fontSize: "10px", color: "#AEAEB2", margin: "1px 0 0" }}>{icon}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "6px" }}>
            <p style={{ fontSize: "24px", fontWeight: 600, color: colour, margin: 0, lineHeight: 1 }}>
              {total.toLocaleString()}
            </p>
            {teamGoal && teamGoal > 0 && (
              <p style={{ fontSize: "14px", fontWeight: 600, color: total >= teamGoal ? "#059669" : "#94A3B8", margin: 0, lineHeight: 1 }}>
                / {teamGoal.toLocaleString()}
              </p>
            )}
          </div>
          <p style={{ fontSize: "11px", color: "#AEAEB2", margin: "2px 0 0" }}>{pctStr}%</p>
        </div>
      </div>

      {/* Prospect vs Lead badges */}
      {breakdown && (breakdown.prospects > 0 || breakdown.leads > 0) && (
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1, background: "#FFFBEB", borderRadius: "8px", padding: "8px 12px", border: "1px solid #FDE68A" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#92400E", margin: 0 }}>Prospects</p>
            <p style={{ fontSize: "18px", fontWeight: 600, color: "#B45309", margin: "2px 0 0", lineHeight: 1 }}>{breakdown.prospects.toLocaleString()}</p>
          </div>
          <div style={{ flex: 1, background: "#EFF6FF", borderRadius: "8px", padding: "8px 12px", border: "1px solid #BFDBFE" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#1E40AF", margin: 0 }}>Leads</p>
            <p style={{ fontSize: "18px", fontWeight: 600, color: "#1D4ED8", margin: "2px 0 0", lineHeight: 1 }}>{breakdown.leads.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Goal vs actual */}
      {goalPercent && goalPercent > 0 && (
        <div style={{ background: "#FAFAFA", borderRadius: "8px", padding: "8px 12px", border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#86868B" }}>
            Goal: <strong>{goalPercent}%</strong> of contacts
          </span>
          <span style={{
            fontSize: "11px",
            fontWeight: 600,
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
      <div style={{ background: "#F5F5F7", borderRadius: "4px", height: "4px", overflow: "hidden", position: "relative" }}>
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
            <span style={{ fontSize: "11px", color: "#3A3A3C" }}>{s.label}</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>
              {s.count.toLocaleString()}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontSize: "11px", color: "#D2D2D7", margin: 0 }}>No data</p>
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
      <span style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>
        {rate}%
      </span>
      <svg width="24" height="16" viewBox="0 0 24 16" style={{ margin: "4px 0" }}>
        <path d="M4 8 L16 8 M12 3 L18 8 L12 13" stroke="#94A3B8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: "9px", color: "#AEAEB2", textTransform: "uppercase", letterSpacing: "0.3px", textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </span>
      {secondaryRate !== undefined && secondaryLabel && (
        <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>
            {secondaryRate}%
          </span>
          <span style={{ fontSize: "9px", color: "#AEAEB2", textTransform: "uppercase", letterSpacing: "0.3px", textAlign: "center", lineHeight: 1.2 }}>
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
  icon,
  rate,
  comparison,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  colour: string;
  bg: string;
  icon: React.ReactNode;
  rate?: string;
  comparison?: { current: number; previous: number };
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        overflow: "hidden",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Header: icon + title */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "10px", color: "#AEAEB2", margin: "1px 0 0" }}>{subtitle}</p>
        </div>
      </div>

      {/* Big number + comparison */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "28px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1, letterSpacing: "-0.5px" }}>
          {total.toLocaleString()}
        </span>
        {comparison && (() => {
          const delta = comparison.current - comparison.previous;
          const better = delta >= 0;
          return (
            <span style={{
              fontSize: "11px",
              fontWeight: 500,
              color: better ? "#059669" : "#DC2626",
              background: better ? "#F0FDF4" : "#FEF2F2",
              borderRadius: "6px",
              padding: "2px 6px",
            }}>
              {better ? "↑" : "↓"} {Math.abs(delta).toLocaleString()}
            </span>
          );
        })()}
      </div>

      {/* Rate / subtitle stat */}
      {rate && (
        <p style={{ fontSize: "11px", color: "#86868B", margin: 0 }}>{rate}</p>
      )}

      {/* Expandable detail */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", borderTop: "1px solid rgba(0,0,0,0.04)", paddingTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}

function MiniRow({ label, count, highlight }: { label: string; count: number; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: highlight ? "#DBEAFE" : "transparent", borderRadius: highlight ? "6px" : 0, padding: highlight ? "4px 8px" : 0 }}>
      <span style={{ fontSize: "12px", color: highlight ? "#1D4ED8" : "#334155", fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: highlight ? "#1D4ED8" : "#0F172A", fontVariantNumeric: "tabular-nums" }}>
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
        borderRadius: "20px",
        padding: "18px 20px",
        border: `1px solid ${met ? "#A7F3D0" : "#E2E8F0"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "20px", fontWeight: 600, color: barColour }}>{current}</span>
          <span style={{ fontSize: "13px", color: "#AEAEB2" }}>/ {goal}</span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: barColour,
              background: met ? "#D1FAE5" : `${colour}15`,
              borderRadius: "18px",
              padding: "2px 8px",
            }}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>

      <div style={{ position: "relative", background: "#F5F5F7", borderRadius: "4px", height: "6px", overflow: "visible", marginBottom: "8px" }}>
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
              background: "#86868B",
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
            <span style={{ fontWeight: 400, color: "#AEAEB2", marginLeft: "6px" }}>
              — {paceLabel.toLowerCase()}
            </span>
          )}
        </span>
        <span style={{ fontSize: "11px", color: "#AEAEB2" }}>{periodLabel}</span>
      </div>
    </div>
  );
}
