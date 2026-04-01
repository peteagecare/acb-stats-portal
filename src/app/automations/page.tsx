"use client";

import { useState } from "react";

/* ── Flow Data ── */

interface Node {
  id: string;
  label: string;
  sub?: string;
  colour: string;
  bg: string;
}

interface Row {
  nodes: Node[];
  label?: string; // label shown above this row
}

const FLOW: Row[] = [
  {
    nodes: [
      { id: "created", label: "Contact Created", sub: "New contact enters the system", colour: "#3B82F6", bg: "#EFF6FF" },
    ],
  },
  {
    label: "Automatically assigned Prospect lifecycle stage + enters Welcome Funnel (30 emails, 30 days)",
    nodes: [
      { id: "prospect-action", label: "Prospect Action", sub: "Brochure, flipbook, pricing guide, newsletter", colour: "#F59E0B", bg: "#FFFBEB" },
      { id: "lead-action", label: "Lead Action", sub: "Callback, contact form, phone call, home design", colour: "#3B82F6", bg: "#EFF6FF" },
      { id: "no-action", label: "No Action", sub: "Didn't engage with the funnel", colour: "#94A3B8", bg: "#F8FAFC" },
    ],
  },
  {
    label: "Lifecycle stage changes based on action taken",
    nodes: [
      { id: "warm-prospect", label: "Warm Prospect", sub: "Engaged but not ready to talk yet", colour: "#F59E0B", bg: "#FFFBEB" },
      { id: "lead", label: "Lead", sub: "Actively interested, wants to talk", colour: "#3B82F6", bg: "#EFF6FF" },
      { id: "cold-sub", label: "Cold - Subscribed", sub: "Still on the mailing list", colour: "#64748B", bg: "#F8FAFC" },
      { id: "cold-unsub", label: "Cold - Unsubscribed", sub: "Opted out of emails", colour: "#94A3B8", bg: "#F1F5F9" },
      { id: "suppliers", label: "Suppliers & Muppets", sub: "Do not email segment", colour: "#CBD5E1", bg: "#F8FAFC" },
    ],
  },
  {
    label: "Try to book a home visit",
    nodes: [
      { id: "home-visit", label: "Home Visit / Deal", sub: "Visit booked, deal in progress", colour: "#0EA5E9", bg: "#F0F9FF" },
    ],
  },
  {
    label: "After the home visit",
    nodes: [
      { id: "won-waiting", label: "Won - Waiting", sub: "Deal won, waiting for install", colour: "#10B981", bg: "#ECFDF5" },
      { id: "deal-recovery", label: "Deal Recovery", sub: "Needs more time or nurturing", colour: "#F97316", bg: "#FFF7ED" },
    ],
  },
  {
    label: "Final outcome",
    nodes: [
      { id: "completed", label: "Completed", sub: "Job done!", colour: "#059669", bg: "#ECFDF5" },
      { id: "deal-lost", label: "Deal Lost", sub: "Did not convert", colour: "#EF4444", bg: "#FEF2F2" },
    ],
  },
];

// Arrows between rows (from → to with optional label)
const ARROWS: { from: string; to: string; label?: string }[] = [
  { from: "prospect-action", to: "warm-prospect" },
  { from: "lead-action", to: "lead" },
  { from: "no-action", to: "cold-sub" },
  { from: "no-action", to: "cold-unsub" },
  { from: "no-action", to: "suppliers" },
  { from: "warm-prospect", to: "lead", label: "Takes lead action" },
  { from: "warm-prospect", to: "cold-sub", label: "Goes cold" },
  { from: "lead", to: "home-visit", label: "Books visit" },
  { from: "home-visit", to: "won-waiting", label: "Won" },
  { from: "home-visit", to: "deal-recovery", label: "Needs time" },
  { from: "deal-recovery", to: "won-waiting", label: "Recovered" },
  { from: "deal-recovery", to: "deal-lost", label: "Lost" },
  { from: "won-waiting", to: "completed" },
];

const allNodes = new Map(FLOW.flatMap((r) => r.nodes).map((n) => [n.id, n]));

/* ── Page ── */

export default function AutomationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNode = selectedId ? allNodes.get(selectedId) ?? null : null;

  const outgoing = selectedId ? ARROWS.filter((a) => a.from === selectedId) : [];
  const incoming = selectedId ? ARROWS.filter((a) => a.to === selectedId) : [];

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #1E293B", padding: "0 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <a href="/"><img src="/acb-logo.png" alt="ACB" style={{ height: "28px", objectFit: "contain" }} /></a>
            <h1 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "white" }}>Customer Journey</h1>
          </div>
          <a href="/" style={{ fontSize: "12px", color: "#64748B", textDecoration: "none" }}>← Dashboard</a>
        </div>
      </header>

      <div style={{ display: "flex" }}>
        {/* Flow */}
        <div style={{ flex: 1, padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "0" }}>
          {FLOW.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* Down arrow + label between rows */}
              {rowIdx > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" }}>
                  <svg width="2" height="20"><line x1="1" y1="0" x2="1" y2="20" stroke="#334155" strokeWidth="1.5" /></svg>
                  {row.label && (
                    <p style={{ fontSize: "11px", color: "#64748B", margin: "6px 0", textAlign: "center", maxWidth: "500px", lineHeight: 1.4 }}>
                      {row.label}
                    </p>
                  )}
                  <svg width="10" height="6" viewBox="0 0 10 6"><path d="M0 0 L5 6 L10 0" fill="#334155" /></svg>
                </div>
              )}

              {/* Nodes */}
              <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
                {row.nodes.map((node) => {
                  const isSelected = selectedId === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedId(isSelected ? null : node.id)}
                      style={{
                        background: isSelected ? node.bg : "#1E293B",
                        border: `2px solid ${isSelected ? node.colour : "#334155"}`,
                        borderRadius: "12px",
                        padding: "16px 24px",
                        cursor: "pointer",
                        minWidth: "160px",
                        maxWidth: "220px",
                        textAlign: "center",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? `0 0 0 3px ${node.colour}30` : "none",
                      }}
                    >
                      <p style={{ fontSize: "13px", fontWeight: 700, color: isSelected ? node.colour : "#E2E8F0", margin: 0 }}>
                        {node.label}
                      </p>
                      {node.sub && (
                        <p style={{ fontSize: "10px", color: isSelected ? "#64748B" : "#64748B", margin: "4px 0 0", lineHeight: 1.3 }}>
                          {node.sub}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div
            style={{
              width: "300px",
              flexShrink: 0,
              background: "#1E293B",
              borderLeft: "1px solid #334155",
              padding: "32px 24px",
              position: "sticky",
              top: "56px",
              height: "calc(100vh - 56px)",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: selectedNode.colour }} />
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "white", margin: 0 }}>{selectedNode.label}</h2>
            </div>

            {selectedNode.sub && (
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px", lineHeight: 1.5 }}>{selectedNode.sub}</p>
            )}

            {incoming.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Comes from</p>
                {incoming.map((a, i) => {
                  const fromNode = allNodes.get(a.from);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: i > 0 ? "6px" : 0 }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: fromNode?.colour ?? "#64748B" }} />
                      <span style={{ fontSize: "13px", color: "#CBD5E1" }}>
                        {fromNode?.label ?? a.from}
                        {a.label && <span style={{ color: "#64748B" }}> — {a.label}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {outgoing.length > 0 && (
              <div>
                <p style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Goes to</p>
                {outgoing.map((a, i) => {
                  const toNode = allNodes.get(a.to);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: i > 0 ? "6px" : 0 }}>
                      <span style={{ color: toNode?.colour ?? "#64748B", fontSize: "12px" }}>→</span>
                      <span style={{ fontSize: "13px", color: "#CBD5E1" }}>
                        {toNode?.label ?? a.to}
                        {a.label && <span style={{ color: "#64748B" }}> — {a.label}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {outgoing.length === 0 && (
              <p style={{ fontSize: "12px", color: "#475569", fontStyle: "italic" }}>Terminal stage — end of journey</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
