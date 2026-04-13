"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

/* ── Types ── */

interface AutomationNode {
  id: string;
  label: string;
  sub?: string;
  colour: string;
  bg: string;
  x: number;
  y: number;
  w?: number;
}

interface Arrow {
  from: string;
  to: string;
  label?: string;
}

/* ── Automation Data ── */

const NODES: AutomationNode[] = [
  // Row 1 — Entry
  { id: "contact-created", label: "Contact Created", sub: "New contact enters the system", colour: "#3B82F6", bg: "#EFF6FF", x: 520, y: 40 },

  // Row 2 — Prospect assignment
  { id: "set-prospect", label: "Set to Prospect Lifecycle Stage", sub: "Automatically assigned on creation", colour: "#F59E0B", bg: "#FFFBEB", x: 520, y: 160 },

  // Row 3 — Welcome funnel
  { id: "welcome-funnel", label: "Welcome Funnel", sub: "30 emails over 30 days. Contact is set to Marketing. Funnel tries to drive prospect or lead action.", colour: "#F59E0B", bg: "#FFFBEB", x: 520, y: 290, w: 320 },

  // Row 4 — Actions split
  { id: "prospect-action", label: "Prospect Action", sub: "Brochure, flipbook, pricing guide, newsletter, physical brochure", colour: "#F59E0B", bg: "#FFFBEB", x: 220, y: 450 },
  { id: "lead-action", label: "Lead Action", sub: "Callback, contact form, phone call, home design, walk-in bath, direct email", colour: "#3B82F6", bg: "#EFF6FF", x: 520, y: 450 },
  { id: "no-action", label: "No Action", sub: "Didn't engage with the funnel", colour: "#94A3B8", bg: "#F8FAFC", x: 820, y: 450 },

  // Row 5 — Lifecycle stages
  { id: "warm-prospect", label: "Warm Prospect", sub: "Engaged but not ready to talk yet", colour: "#F59E0B", bg: "#FFFBEB", x: 220, y: 600 },
  { id: "lead", label: "Lead", sub: "Actively interested, wants to talk", colour: "#3B82F6", bg: "#EFF6FF", x: 520, y: 600 },
  { id: "cold-subscribed", label: "Cold - Subscribed", sub: "Still on the mailing list", colour: "#64748B", bg: "#F8FAFC", x: 820, y: 600 },
  { id: "cold-unsubscribed", label: "Cold - Unsubscribed", sub: "Opted out of emails", colour: "#94A3B8", bg: "#F1F5F9", x: 1050, y: 600 },

  // Right column — automations
  { id: "email-sequences", label: "Email Sequences", sub: "Prospect nurture, lead follow-up, cold re-engagement", colour: "#6366F1", bg: "#EEF2FF", x: 1050, y: 290 },
  { id: "high-lead-score", label: "High Lead Score", sub: "Auto-notify sales when score threshold hit", colour: "#6366F1", bg: "#EEF2FF", x: 1050, y: 160 },

  // Row 6 — Booking
  { id: "home-visit", label: "Home Visit Booked", sub: "Deal created in pipeline", colour: "#0EA5E9", bg: "#F0F9FF", x: 520, y: 760 },

  // Row 7 — Outcomes
  { id: "won-waiting", label: "Won - Waiting for Install", sub: "Deal won, job scheduled", colour: "#10B981", bg: "#ECFDF5", x: 320, y: 900 },
  { id: "deal-recovery", label: "Deal Recovery", sub: "Needs more time or nurturing", colour: "#F97316", bg: "#FFF7ED", x: 720, y: 900 },

  // Row 8 — Final
  { id: "completed", label: "Completed", sub: "Job done, bathroom installed", colour: "#059669", bg: "#ECFDF5", x: 220, y: 1050 },
  { id: "review-request", label: "Review Request", sub: "Auto email asking for Google/Facebook review", colour: "#6366F1", bg: "#EEF2FF", x: 420, y: 1050 },
  { id: "deal-lost", label: "Deal Lost", sub: "Did not convert", colour: "#EF4444", bg: "#FEF2F2", x: 720, y: 1050 },
  { id: "lost-recovery", label: "Lost Deal Nurture", sub: "Re-engagement email sequence", colour: "#6366F1", bg: "#EEF2FF", x: 920, y: 1050 },
];

const ARROWS: Arrow[] = [
  { from: "contact-created", to: "set-prospect" },
  { from: "set-prospect", to: "welcome-funnel" },
  { from: "welcome-funnel", to: "prospect-action", label: "Downloads content" },
  { from: "welcome-funnel", to: "lead-action", label: "Requests contact" },
  { from: "welcome-funnel", to: "no-action", label: "No engagement" },
  { from: "prospect-action", to: "warm-prospect" },
  { from: "lead-action", to: "lead" },
  { from: "no-action", to: "cold-subscribed", label: "Stays subscribed" },
  { from: "no-action", to: "cold-unsubscribed", label: "Unsubscribes" },
  { from: "warm-prospect", to: "lead", label: "Takes lead action" },
  { from: "warm-prospect", to: "cold-subscribed", label: "Goes cold" },
  { from: "lead", to: "home-visit", label: "Books visit" },
  { from: "home-visit", to: "won-waiting", label: "Deal won" },
  { from: "home-visit", to: "deal-recovery", label: "Needs time" },
  { from: "deal-recovery", to: "won-waiting", label: "Recovered" },
  { from: "deal-recovery", to: "deal-lost", label: "Lost" },
  { from: "won-waiting", to: "completed" },
  { from: "completed", to: "review-request", label: "Auto-triggered" },
  { from: "deal-lost", to: "lost-recovery", label: "Auto-enrolled" },
  // Automation arrows
  { from: "warm-prospect", to: "email-sequences", label: "Nurture sequence" },
  { from: "cold-subscribed", to: "email-sequences", label: "Re-engagement" },
  { from: "email-sequences", to: "high-lead-score", label: "Score increases" },
  { from: "high-lead-score", to: "lead", label: "Auto-qualifies" },
];

const nodeMap = new Map(NODES.map((n) => [n.id, n]));

/* ── Helpers ── */

const NODE_W = 200;
const NODE_H_BASE = 70;

function getNodeCenter(n: AutomationNode): { cx: number; cy: number } {
  const w = n.w ?? NODE_W;
  return { cx: n.x + w / 2, cy: n.y + NODE_H_BASE / 2 };
}

function getEdgeMidpoint(a: AutomationNode, b: AutomationNode): { mx: number; my: number } {
  const ac = getNodeCenter(a);
  const bc = getNodeCenter(b);
  return { mx: (ac.cx + bc.cx) / 2, my: (ac.cy + bc.cy) / 2 };
}

/* ── Page ── */

export default function CustomerAutomationJourney() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [navOpen, setNavOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = selectedId ? nodeMap.get(selectedId) ?? null : null;
  const outgoing = selectedId ? ARROWS.filter((a) => a.from === selectedId) : [];
  const incoming = selectedId ? ARROWS.filter((a) => a.to === selectedId) : [];

  // Highlight connected nodes
  const connectedIds = new Set<string>();
  if (selectedId) {
    connectedIds.add(selectedId);
    outgoing.forEach((a) => connectedIds.add(a.to));
    incoming.forEach((a) => connectedIds.add(a.from));
  }

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom with scroll
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((z) => Math.min(2, Math.max(0.3, z + delta)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Fit to view on mount
  useEffect(() => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const maxX = Math.max(...NODES.map((n) => n.x + (n.w ?? NODE_W)));
    const maxY = Math.max(...NODES.map((n) => n.y + NODE_H_BASE + 30));
    const fitZoom = Math.min(rect.width / (maxX + 80), (rect.height) / (maxY + 80), 1);
    setZoom(Math.max(0.4, fitZoom));
    setPan({ x: 40, y: 40 });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #1E293B", padding: "0 32px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <a href="/"><Image src="/acb-logo.png" alt="ACB" height={28} width={100} style={{ objectFit: "contain" }} /></a>
            <h1 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "white" }}>Customer Automation Journey</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Zoom controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: "6px", color: "#94A3B8", width: "28px", height: "28px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
              <span style={{ fontSize: "11px", color: "#64748B", minWidth: "36px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: "6px", color: "#94A3B8", width: "28px", height: "28px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              <button onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: "6px", color: "#94A3B8", padding: "4px 10px", cursor: "pointer", fontSize: "11px" }}>Reset</button>
            </div>

            {/* Nav menu */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setNavOpen(!navOpen)}
                style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: "8px", color: "#CBD5E1", padding: "6px 14px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
                Menu
              </button>
              {navOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#1E293B", border: "1px solid #334155", borderRadius: "10px", padding: "6px", minWidth: "200px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                  <a href="/" style={{ display: "block", padding: "8px 14px", borderRadius: "6px", color: "#CBD5E1", textDecoration: "none", fontSize: "13px" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#334155")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    Dashboard
                  </a>
                  <a href="/automations" style={{ display: "block", padding: "8px 14px", borderRadius: "6px", color: "#CBD5E1", textDecoration: "none", fontSize: "13px" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#334155")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    Customer Journey
                  </a>
                  <div style={{ padding: "8px 14px", borderRadius: "6px", color: "white", fontSize: "13px", fontWeight: 600, background: "#334155" }}>
                    Automation Journey
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            flex: 1,
            overflow: "hidden",
            cursor: isPanning ? "grabbing" : "grab",
            position: "relative",
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              position: "absolute",
              top: 0,
              left: 0,
              width: "1400px",
              height: "1200px",
            }}
          >
            {/* SVG arrows */}
            <svg
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              viewBox="0 0 1400 1200"
            >
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#475569" />
                </marker>
                <marker id="arrowhead-highlight" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#3B82F6" />
                </marker>
              </defs>
              {ARROWS.map((arrow, i) => {
                const fromNode = nodeMap.get(arrow.from);
                const toNode = nodeMap.get(arrow.to);
                if (!fromNode || !toNode) return null;

                const fc = getNodeCenter(fromNode);
                const tc = getNodeCenter(toNode);
                const isHighlighted = selectedId && (arrow.from === selectedId || arrow.to === selectedId);
                const isDimmed = selectedId && !isHighlighted;

                // Simple curved path
                const dx = tc.cx - fc.cx;
                const dy = tc.cy - fc.cy;
                const midX = fc.cx + dx * 0.5;
                const midY = fc.cy + dy * 0.5;
                const curveOffset = Math.abs(dx) > 200 ? 40 : 0;

                return (
                  <g key={i} style={{ opacity: isDimmed ? 0.15 : 1, transition: "opacity 0.2s" }}>
                    <path
                      d={`M ${fc.cx} ${fc.cy + NODE_H_BASE / 2} Q ${midX} ${midY + curveOffset} ${tc.cx} ${tc.cy - NODE_H_BASE / 2}`}
                      fill="none"
                      stroke={isHighlighted ? "#3B82F6" : "#475569"}
                      strokeWidth={isHighlighted ? 2 : 1.5}
                      strokeDasharray={isHighlighted ? "none" : "none"}
                      markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
                    />
                    {arrow.label && (
                      <text
                        x={midX}
                        y={midY + curveOffset - 6}
                        textAnchor="middle"
                        fill={isHighlighted ? "#93C5FD" : "#64748B"}
                        fontSize="10"
                        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
                      >
                        {arrow.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {NODES.map((node) => {
              const isSelected = selectedId === node.id;
              const isConnected = connectedIds.has(node.id);
              const isDimmed = selectedId && !isConnected;
              const w = node.w ?? NODE_W;

              return (
                <button
                  key={node.id}
                  data-node
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(isSelected ? null : node.id);
                  }}
                  style={{
                    position: "absolute",
                    left: node.x,
                    top: node.y,
                    width: w,
                    background: isSelected ? node.bg : "#1E293B",
                    border: `2px solid ${isSelected ? node.colour : isConnected ? node.colour + "60" : "#334155"}`,
                    borderRadius: "12px",
                    padding: "14px 18px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    opacity: isDimmed ? 0.25 : 1,
                    boxShadow: isSelected
                      ? `0 0 0 3px ${node.colour}30, 0 4px 16px rgba(0,0,0,0.3)`
                      : "0 2px 8px rgba(0,0,0,0.2)",
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: node.sub ? 4 : 0 }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: node.colour, flexShrink: 0 }} />
                    <p style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? node.colour : "#E2E8F0", margin: 0, lineHeight: 1.3 }}>
                      {node.label}
                    </p>
                  </div>
                  {node.sub && (
                    <p style={{ fontSize: "10px", color: "#64748B", margin: "2px 0 0 16px", lineHeight: 1.4 }}>
                      {node.sub}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
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
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => setSelectedId(null)}
              style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: "11px", padding: 0, marginBottom: "16px" }}
            >
              &times; Close
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: selectedNode.colour }} />
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "white", margin: 0 }}>{selectedNode.label}</h2>
            </div>

            {selectedNode.sub && (
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px", lineHeight: 1.6 }}>{selectedNode.sub}</p>
            )}

            {incoming.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Comes from</p>
                {incoming.map((a, i) => {
                  const fromNode = nodeMap.get(a.from);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedId(a.from)}
                      style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: i > 0 ? "6px" : 0, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
                    >
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: fromNode?.colour ?? "#64748B" }} />
                      <span style={{ fontSize: "13px", color: "#CBD5E1" }}>
                        {fromNode?.label ?? a.from}
                        {a.label && <span style={{ color: "#64748B" }}> &mdash; {a.label}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {outgoing.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Goes to</p>
                {outgoing.map((a, i) => {
                  const toNode = nodeMap.get(a.to);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedId(a.to)}
                      style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: i > 0 ? "6px" : 0, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
                    >
                      <span style={{ color: toNode?.colour ?? "#64748B", fontSize: "12px" }}>&rarr;</span>
                      <span style={{ fontSize: "13px", color: "#CBD5E1" }}>
                        {toNode?.label ?? a.to}
                        {a.label && <span style={{ color: "#64748B" }}> &mdash; {a.label}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {outgoing.length === 0 && (
              <p style={{ fontSize: "12px", color: "#475569", fontStyle: "italic" }}>Terminal stage &mdash; end of journey</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
