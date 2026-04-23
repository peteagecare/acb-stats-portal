"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════
   Journey sources
   ═══════════════════════════════════════════ */
const SOURCES = [
  { key: "PPC", label: "PPC", color: "#E8833A" },
  { key: "SEO", label: "SEO", color: "#30A46C" },
  { key: "Content", label: "Content", color: "#8E4EC6" },
  { key: "TV", label: "TV", color: "#D93D42" },
  { key: "Other", label: "Other", color: "#86868B" },
] as const;

type SourceKey = (typeof SOURCES)[number]["key"];
interface SourceDetail { value: string; label: string; count: number; }
type ByCategory = Record<SourceKey, { total: number; sources: SourceDetail[] }>;
interface ConversionAction { label: string; value: string; count: number; }
interface JourneySelection { id: string; values: string[]; count: number; label: string; }

/* ═══════════════════════════════════════════
   Automation definitions
   ═══════════════════════════════════════════ */
interface Automation { id: string; name: string; emails: number; color: string; category: string; }

const AUTOMATIONS: Automation[] = [
  { id: "purchased-forevercare", name: "Purchased ForeverCare", emails: 1, color: "#30A46C", category: "Post-Sale" },
  { id: "completed-review", name: "Completed Review Emails", emails: 4, color: "#30A46C", category: "Post-Sale" },
  { id: "referral-campaign", name: "Referral Campaign", emails: 4, color: "#30A46C", category: "Post-Sale" },
  { id: "physical-brochure", name: "Physical Brochure Request", emails: 3, color: "#E8833A", category: "Prospect" },
  { id: "lost-sends-survey", name: "Lost Sends Survey", emails: 1, color: "#D93D42", category: "Recovery" },
  { id: "lead-source-hi-value", name: "Lead Source, Hi Value Users", emails: 1, color: "#0071E3", category: "Lead" },
  { id: "home-visit-form", name: "Has Filled Out Home Visit Form", emails: 1, color: "#0071E3", category: "Lead" },
  { id: "prospect-lifecycle", name: "Prospect Lifecycle", emails: 5, color: "#E8833A", category: "Prospect" },
  { id: "welcome-funnel", name: "Welcome Funnel", emails: 31, color: "#0071E3", category: "Lead" },
  { id: "hi-intent-not-booked", name: "Hi Intent - Home Visit Requested But Not Booked", emails: 5, color: "#D93D42", category: "Recovery" },
  { id: "cold-10-sessions", name: "Prospects/Cold - 10+ Sessions", emails: 6, color: "#E8833A", category: "Prospect" },
  { id: "recent-brochure-dl", name: "Prospects - Recent Brochure Downloads", emails: 4, color: "#E8833A", category: "Prospect" },
  { id: "installation-reminder", name: "Installation Reminder", emails: 1, color: "#30A46C", category: "Post-Sale" },
];

/* ═══════════════════════════════════════════
   Layout types
   ═══════════════════════════════════════════ */
interface NodePos { id: string; x: number; y: number; }
interface Connection { from: string; to: string; note?: string; }
interface CustomNode { id: string; label: string; notes: string; color: string; x: number; y: number; }
interface LayoutData { positions: NodePos[]; connections: Connection[]; customNodes?: CustomNode[]; }

const NODE_W = 220;
const NODE_H = 72;
const CUSTOM_W = 180;
const CUSTOM_H_BASE = 52;

const BUBBLE_COLORS = [
  { label: "Blue", value: "#0071E3" },
  { label: "Green", value: "#30A46C" },
  { label: "Orange", value: "#E8833A" },
  { label: "Purple", value: "#8E4EC6" },
  { label: "Red", value: "#D93D42" },
  { label: "Teal", value: "#0891B2" },
  { label: "Grey", value: "#6B7280" },
];

function defaultPositions(): NodePos[] {
  const cols = 4, gapX = 260, gapY = 110, startX = 40, startY = 40;
  return AUTOMATIONS.map((_, i) => ({ id: AUTOMATIONS[i].id, x: startX + (i % cols) * gapX, y: startY + Math.floor(i / cols) * gapY }));
}

function uid() { return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */
function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function getDefaultRange() { const now = new Date(); return { from: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmtDate(now) }; }

/* ═══════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════ */
export default function AutomationMapPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  /* Journey state */
  const [count, setCount] = useState<number | null>(null);
  const [bySource, setBySource] = useState<ByCategory | null>(null);
  const [actions, setActions] = useState<ConversionAction[] | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [selection, setSelection] = useState<JourneySelection | null>(null);

  /* Automation & custom node state */
  const [positions, setPositions] = useState<NodePos[]>(defaultPositions);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [customNodes, setCustomNodes] = useState<CustomNode[]>([]);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CustomNode | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [arrowMenu, setArrowMenu] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [arrowNoteEdit, setArrowNoteEdit] = useState<{ idx: number; note: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selRect, setSelRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const multiDragStart = useRef<Map<string, { x: number; y: number }>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load journey data ── */
  useEffect(() => {
    let cancelled = false;
    setJourneyLoading(true);
    Promise.all([
      fetch(`/api/hubspot/contacts-created?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
      fetch(`/api/hubspot/contacts-by-source?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
    ])
      .then(([totalData, sourceData]) => { if (!cancelled) { setCount(totalData.total); setBySource(sourceData.byCategory); } })
      .catch(() => { if (!cancelled) { setCount(null); setBySource(null); } })
      .finally(() => { if (!cancelled) setJourneyLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  useEffect(() => {
    let cancelled = false;
    setActionsLoading(true);
    const sp = selection ? `&sources=${encodeURIComponent(selection.values.join(","))}` : "";
    fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}${sp}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => { if (!cancelled) setActions(data.actions); })
      .catch(() => { if (!cancelled) setActions(null); })
      .finally(() => { if (!cancelled) setActionsLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, selection]);

  useEffect(() => { setSelection(null); }, [from, to]);

  /* ── Load layout ── */
  useEffect(() => {
    fetch("/api/automation-layout")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LayoutData | null) => {
        if (data?.positions?.length) {
          const savedMap = new Map(data.positions.map((p) => [p.id, p]));
          setPositions(AUTOMATIONS.map((a, i) => savedMap.get(a.id) ?? defaultPositions()[i]));
        }
        if (data?.connections) setConnections(data.connections);
        if (data?.customNodes) setCustomNodes(data.customNodes);
      })
      .catch(() => {})
      .finally(() => setLayoutLoaded(true));
  }, []);

  /* ── Persist (debounced) ── */
  const persistLayout = useCallback((pos: NodePos[], conns: Connection[], custom: CustomNode[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      fetch("/api/automation-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: pos, connections: conns, customNodes: custom }),
      })
        .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 600);
  }, []);

  const CONTACT_CREATED_ID = "contact-created";
  const CC_NODE_W = 200;
  const CC_NODE_H = 40;

  /* ── Build combined position map for arrows ── */
  function getAllPositions(): NodePos[] {
    // Contact Created: centered above the canvas, arrow starts from top edge
    const allXs = positions.map((p) => p.x + NODE_W / 2);
    const centerX = allXs.length ? (Math.min(...allXs) + Math.max(...allXs)) / 2 - CC_NODE_W / 2 : 400;
    return [
      { id: CONTACT_CREATED_ID, x: centerX, y: -CC_NODE_H - 10 },
      ...positions,
      ...customNodes.map((cn) => ({ id: cn.id, x: cn.x, y: cn.y })),
    ];
  }

  /* ── Get node dimensions by id ── */
  function getNodeDims(id: string): { w: number; h: number } {
    if (id === CONTACT_CREATED_ID) return { w: CC_NODE_W, h: CC_NODE_H };
    const cn = customNodes.find((c) => c.id === id);
    if (cn) {
      // Estimate height: base + extra lines for long labels + notes
      const labelLines = Math.ceil(cn.label.length / 16);
      const h = CUSTOM_H_BASE + (labelLines > 1 ? (labelLines - 1) * 16 : 0) + (cn.notes ? 16 : 0);
      return { w: CUSTOM_W, h };
    }
    return { w: NODE_W, h: NODE_H };
  }

  /* ── Get label for any node ── */
  function getNodeLabel(id: string): string {
    if (id === CONTACT_CREATED_ID) return "Contact Created";
    const auto = AUTOMATIONS.find((a) => a.id === id);
    if (auto) return auto.name;
    const cn = customNodes.find((c) => c.id === id);
    if (cn) return cn.label;
    return id;
  }

  /* ── Drag handlers ── */
  function onNodePointerDown(id: string, e: React.PointerEvent) {
    if (connecting || addMode) return;
    e.preventDefault();
    e.stopPropagation();
    const all = getAllPositions();
    const pos = all.find((p) => p.id === id);
    const canvas = canvasRef.current;
    if (!pos || !canvas) return;
    const rect = canvas.getBoundingClientRect();

    // If this node is already selected, drag all selected nodes together
    // If not selected, select only this node (unless shift held)
    if (!selectedIds.has(id)) {
      if (e.shiftKey) {
        setSelectedIds((prev) => new Set([...prev, id]));
      } else {
        setSelectedIds(new Set([id]));
      }
    }

    // Store starting positions of all selected nodes + this one
    const dragSet = new Set(selectedIds);
    dragSet.add(id);
    const starts = new Map<string, { x: number; y: number }>();
    for (const did of dragSet) {
      const dp = all.find((p) => p.id === did);
      if (dp) starts.set(did, { x: dp.x, y: dp.y });
    }
    multiDragStart.current = starts;

    dragOffset.current = {
      x: e.clientX - rect.left - pos.x,
      y: e.clientY - rect.top - pos.y,
    };
    setDragging(id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Rubber-band selection
    if (selRect) {
      const x2 = e.clientX - rect.left;
      const y2 = e.clientY - rect.top;
      setSelRect((prev) => prev ? { ...prev, x2, y2 } : null);
      return;
    }

    if (!dragging) return;

    const newX = e.clientX - rect.left - dragOffset.current.x;
    const newY = e.clientY - rect.top - dragOffset.current.y;
    const startPos = multiDragStart.current.get(dragging);
    if (!startPos) return;
    const dx = newX - startPos.x;
    const dy = newY - startPos.y;

    // Move all nodes in the drag set
    setPositions((prev) => prev.map((p) => {
      const sp = multiDragStart.current.get(p.id);
      if (!sp) return p;
      return { ...p, x: Math.max(0, sp.x + dx), y: Math.max(0, sp.y + dy) };
    }));
    setCustomNodes((prev) => prev.map((c) => {
      const sp = multiDragStart.current.get(c.id);
      if (!sp) return c;
      return { ...c, x: Math.max(0, sp.x + dx), y: Math.max(0, sp.y + dy) };
    }));
  }

  function onPointerUp() {
    if (selRect) {
      const x1 = Math.min(selRect.x1, selRect.x2), x2 = Math.max(selRect.x1, selRect.x2);
      const y1 = Math.min(selRect.y1, selRect.y2), y2 = Math.max(selRect.y1, selRect.y2);
      const w = x2 - x1, h = y2 - y1;
      // Only select if dragged a meaningful distance
      if (w > 5 || h > 5) {
        const hit = new Set<string>();
        for (const p of positions) {
          if (p.x + NODE_W > x1 && p.x < x2 && p.y + NODE_H > y1 && p.y < y2) hit.add(p.id);
        }
        for (const c of customNodes) {
          const ch = CUSTOM_H_BASE;
          if (c.x + CUSTOM_W > x1 && c.x < x2 && c.y + ch > y1 && c.y < y2) hit.add(c.id);
        }
        setSelectedIds(hit);
      }
      setSelRect(null);
      return;
    }
    if (dragging) {
      setDragging(null);
      setPositions((pos) => {
        setCustomNodes((custom) => {
          persistLayout(pos, connections, custom);
          return custom;
        });
        return pos;
      });
    }
  }

  /* ── Canvas background pointer down: start rubber-band ── */
  function onCanvasPointerDown(e: React.PointerEvent) {
    if (connecting || addMode) return;
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    if ((e.target as HTMLElement).tagName === "path" || (e.target as HTMLElement).tagName === "g") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelRect({ x1: x, y1: y, x2: x, y2: y });
    setSelectedIds(new Set());
    // Capture pointer so we get move/up even if cursor leaves the div
    canvas.setPointerCapture(e.pointerId);
  }

  /* ── Connect mode ── */
  function handleNodeClick(id: string) {
    if (!connecting) return;
    if (connecting === id) { setConnecting(null); return; }
    const exists = connections.some((c) => c.from === connecting && c.to === id);
    if (!exists) {
      const updated = [...connections, { from: connecting, to: id }];
      setConnections(updated);
      persistLayout(positions, updated, customNodes);
    }
    setConnecting(null);
  }

  function startConnect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConnecting(id);
  }

  function removeConnection(idx: number) {
    const updated = connections.filter((_, i) => i !== idx);
    setConnections(updated);
    persistLayout(positions, updated, customNodes);
  }

  /* ── Custom node: create on canvas click ── */
  function handleCanvasClick(e: React.MouseEvent) {
    if (!addMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Don't create if we clicked on a node
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - CUSTOM_W / 2;
    const y = e.clientY - rect.top - CUSTOM_H_BASE / 2;
    const newNode: CustomNode = { id: uid(), label: "", notes: "", color: "#0071E3", x: Math.max(0, x), y: Math.max(0, y) };
    setAddMode(false);
    setEditingCustom(newNode);
  }

  /* ── Custom node: save from modal ── */
  function handleSaveCustom(node: CustomNode) {
    const isNew = !customNodes.some((c) => c.id === node.id);
    let updated: CustomNode[];
    if (isNew) {
      updated = [...customNodes, node];
    } else {
      updated = customNodes.map((c) => (c.id === node.id ? node : c));
    }
    setCustomNodes(updated);
    setEditingCustom(null);
    persistLayout(positions, connections, updated);
  }

  /* ── Custom node: delete ── */
  function handleDeleteCustom(id: string) {
    const updatedNodes = customNodes.filter((c) => c.id !== id);
    const updatedConns = connections.filter((c) => c.from !== id && c.to !== id);
    setCustomNodes(updatedNodes);
    setConnections(updatedConns);
    setEditingCustom(null);
    persistLayout(positions, updatedConns, updatedNodes);
  }

  /* ── Arrow path ── */
  function getArrowPath(fromId: string, toId: string) {
    const all = getAllPositions();
    const fromP = all.find((p) => p.id === fromId);
    const toP = all.find((p) => p.id === toId);
    if (!fromP || !toP) return "";
    const fd = getNodeDims(fromId), td = getNodeDims(toId);

    // Special case: arrows from Contact Created come straight down from top of canvas
    if (fromId === CONTACT_CREATED_ID) {
      const ex = toP.x + td.w / 2;
      const ey = toP.y;
      const sx = ex; // start directly above the target
      const sy = 0;  // top of canvas
      const my = ey / 2;
      return `M${sx},${sy} C${sx},${my} ${ex},${my} ${ex},${ey}`;
    }
    // Special case: arrows to Contact Created go up to top of canvas
    if (toId === CONTACT_CREATED_ID) {
      const sx = fromP.x + fd.w / 2;
      const sy = fromP.y;
      const ex = sx;
      const ey = 0;
      const my = sy / 2;
      return `M${sx},${sy} C${sx},${my} ${ex},${my} ${ex},${ey}`;
    }

    const fx = fromP.x + fd.w / 2, fy = fromP.y + fd.h / 2;
    const tx = toP.x + td.w / 2, ty = toP.y + td.h / 2;
    const dx = tx - fx, dy = ty - fy;
    let sx: number, sy: number, ex: number, ey: number;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) { sx = fromP.x + fd.w; sy = fromP.y + fd.h / 2; ex = toP.x; ey = toP.y + td.h / 2; }
      else { sx = fromP.x; sy = fromP.y + fd.h / 2; ex = toP.x + td.w; ey = toP.y + td.h / 2; }
    } else {
      if (dy > 0) { sx = fromP.x + fd.w / 2; sy = fromP.y + fd.h; ex = toP.x + td.w / 2; ey = toP.y; }
      else { sx = fromP.x + fd.w / 2; sy = fromP.y; ex = toP.x + td.w / 2; ey = toP.y + td.h; }
    }
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    return Math.abs(dx) > Math.abs(dy)
      ? `M${sx},${sy} C${mx},${sy} ${mx},${ey} ${ex},${ey}`
      : `M${sx},${sy} C${sx},${my} ${ex},${my} ${ex},${ey}`;
  }

  /* ── Canvas size ── */
  const allPos = getAllPositions();
  const maxX = Math.max(...allPos.map((p) => p.x + NODE_W + 100), 1200);
  const maxY = Math.max(...allPos.map((p) => p.y + NODE_H + 100), 600);
  const autoMap = new Map(AUTOMATIONS.map((a) => [a.id, a]));
  const autoCats = [...new Set(AUTOMATIONS.map((a) => a.category))];

  /* Date ranges */
  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const threeMonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const todayStr = fmtDate(today);
  const ranges = [
    { label: "Today", from: todayStr, to: todayStr },
    { label: "This Week", from: fmtDate(weekStart), to: fmtDate((() => { const s = new Date(weekStart); s.setDate(s.getDate() + 6); return s; })()) },
    { label: "This Month", from: fmtDate(monthStart), to: fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)) },
    { label: "Last Month", from: fmtDate(lastMonthStart), to: fmtDate(lastMonthEnd) },
    { label: "Last 3 Months", from: fmtDate(threeMonthsStart), to: fmtDate(lastMonthEnd) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* ════════════ HEADER ════════════ */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid #E5E5EA", zIndex: 20, gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "#1D1D1F", margin: 0 }}>Customer Journey &amp; Automations</h1>
          <p style={{ fontSize: 11, color: "#86868B", margin: "2px 0 0" }}>
            Click a source to filter. Drag nodes to arrange. Click &quot;+ Add step&quot; then click the canvas to place it.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Add step button */}
          <button
            onClick={() => { setAddMode(!addMode); setConnecting(null); }}
            style={{
              fontSize: 11, padding: "5px 12px", borderRadius: 999,
              border: addMode ? "2px solid #0071E3" : "1px solid #E5E5EA",
              background: addMode ? "rgba(0,113,227,0.1)" : "white",
              color: addMode ? "#0071E3" : "#1D1D1F",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            {addMode ? "Click canvas to place..." : "+ Add step"}
          </button>

          {connecting && (
            <span style={{ fontSize: 11, color: "#0071E3", background: "rgba(0,113,227,0.1)", padding: "4px 10px", borderRadius: 999, fontWeight: 600 }}>
              Click any node to connect from &quot;{getNodeLabel(connecting)}&quot;
            </span>
          )}
          {connecting && (
            <button onClick={() => setConnecting(null)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, border: "1px solid #E5E5EA", background: "white", cursor: "pointer", fontWeight: 600, color: "#86868B" }}>Cancel</button>
          )}
          {saved && <span style={{ fontSize: 11, color: "#107A3E", fontWeight: 600 }}>Saved</span>}
          {saving && <span style={{ fontSize: 11, color: "#86868B", fontWeight: 600 }}>Saving...</span>}
          <div style={{ display: "flex", gap: "2px", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3 }}>
            {ranges.map((r) => {
              const active = from === r.from && to === r.to;
              return (
                <button key={r.label} onClick={() => { setFrom(r.from); setTo(r.to); }}
                  style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? "white" : "#86868B", background: active ? "#0071E3" : "transparent", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {r.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.04)", borderRadius: 18, padding: "6px 12px" }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ border: "none", background: "transparent", fontSize: 12, color: "#1D1D1F", outline: "none", fontFamily: "inherit" }} />
            <span style={{ color: "#AEAEB2", fontSize: 12 }}>{"\u2192"}</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ border: "none", background: "transparent", fontSize: 12, color: "#1D1D1F", outline: "none", fontFamily: "inherit" }} />
          </div>
        </div>
      </header>

      {/* ════════════ SCROLLABLE BODY ════════════ */}
      <div style={{ flex: 1, overflow: "auto", background: "#FAFAFA", backgroundImage: "radial-gradient(circle, #D1D1D6 1px, transparent 1px)", backgroundSize: "24px 24px" }}>

        {/* ──── JOURNEY SECTION ──── */}
        <div style={{ padding: "36px 24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          {/* Source channels */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", maxWidth: "100%" }}>
            {SOURCES.map((s) => {
              const cat = bySource?.[s.key];
              const total = cat?.total;
              const sources = cat?.sources?.filter((src) => src.count > 0) ?? [];
              const catId = `cat:${s.key}`;
              const isCatSelected = selection?.id === catId;
              const anySelected = selection !== null;
              const catSourceValues = cat?.sources?.map((src) => src.value) ?? [];
              return (
                <div key={s.key} style={{
                  display: "flex", flexDirection: "column", gap: 8,
                  background: s.color, color: "#FFFFFF", padding: "12px 14px", borderRadius: 8,
                  fontSize: 13, fontWeight: 500, minWidth: 160,
                  boxShadow: isCatSelected ? `0 0 0 3px ${s.color}, 0 0 0 5px #FFFFFF, 0 2px 8px rgba(0,0,0,0.15)` : "0 1px 3px rgba(0,0,0,0.08)",
                  opacity: anySelected && !isCatSelected && !selection?.values.some((v) => catSourceValues.includes(v)) ? 0.45 : 1,
                  transition: "opacity 0.15s, box-shadow 0.15s", userSelect: "none",
                }}>
                  <button onClick={() => {
                    if (!cat || catSourceValues.length === 0) return;
                    setSelection(isCatSelected ? null : { id: catId, values: catSourceValues, count: cat.total, label: s.label });
                  }} disabled={!cat || catSourceValues.length === 0} style={{
                    all: "unset", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    cursor: cat && catSourceValues.length > 0 ? "pointer" : "default",
                  }}>
                    <span>{s.label}</span>
                    <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600, minWidth: 24, textAlign: "center" }}>
                      {journeyLoading ? "\u2026" : total?.toLocaleString() ?? "\u2014"}
                    </span>
                  </button>
                  {sources.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                      {sources.map((src) => {
                        const srcId = `src:${src.value}`;
                        const isSrcSelected = selection?.id === srcId;
                        return (
                          <button key={src.value} onClick={() => setSelection(isSrcSelected ? null : { id: srcId, values: [src.value], count: src.count, label: src.label })}
                            style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: isSrcSelected ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.18)", borderRadius: 4, padding: "5px 10px", fontSize: 11, fontWeight: 400, cursor: "pointer", outline: isSrcSelected ? "1.5px solid #FFFFFF" : "none" }}>
                            <span>{src.label}</span>
                            <span style={{ fontWeight: 600 }}>{src.count.toLocaleString()}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {(selection || actionsLoading) && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#86868B" }}>
              {selection && <span>Showing paths for <strong style={{ color: "#1D1D1F" }}>{selection.label}</strong> ({selection.count.toLocaleString()} contacts)</span>}
              {actionsLoading && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#007AFF" }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #D1D1D6", borderTopColor: "#007AFF", animation: "cj-spin 0.7s linear infinite", display: "inline-block" }} />
                  Loading...
                </span>
              )}
              {selection && !actionsLoading && (
                <button onClick={() => setSelection(null)} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#1D1D1F", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
              )}
            </div>
          )}
          <style jsx global>{`@keyframes cj-spin { to { transform: rotate(360deg); } }`}</style>

          <div style={{ width: 2, height: 32, background: "#C7C7CC" }} />

          {/* Conversion actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 900, opacity: actionsLoading ? 0.45 : 1, transition: "opacity 0.15s" }}>
            {actionsLoading && !actions ? (
              <div style={{ color: "#86868B", fontSize: 12 }}>Loading actions...</div>
            ) : (
              (actions ?? []).filter((a) => a.count > 0).sort((a, b) => b.count - a.count).map((a) => (
                <div key={a.value} style={{
                  display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", color: "#1D1D1F",
                  border: "1px solid #D1D1D6", padding: "7px 12px 7px 14px", borderRadius: 6, fontSize: 12,
                  fontWeight: 500, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", userSelect: "none",
                }}>
                  <span>{a.label}</span>
                  <span style={{ background: "#F2F2F7", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 600, minWidth: 22, textAlign: "center" }}>{a.count.toLocaleString()}</span>
                </div>
              ))
            )}
            {!actionsLoading && actions && actions.filter((a) => a.count > 0).length === 0 && (
              <div style={{ color: "#86868B", fontSize: 12 }}>No conversion actions in this period</div>
            )}
          </div>

          <div style={{ width: 2, height: 32, background: "#C7C7CC" }} />

          {/* Contact Created */}
          <div
            data-node
            onClick={(e) => { e.stopPropagation(); if (connecting) handleNodeClick(CONTACT_CREATED_ID); }}
            style={{
              display: "flex", alignItems: "center", gap: 10, background: "#5B8DB8", color: "#FFFFFF",
              padding: "12px 20px 12px 28px", borderRadius: 6, fontSize: 14, fontWeight: 500,
              boxShadow: connecting === CONTACT_CREATED_ID ? "0 0 0 4px rgba(91,141,184,0.4)" : "0 1px 3px rgba(0,0,0,0.08)",
              userSelect: "none", cursor: connecting ? "pointer" : "default",
              transition: "box-shadow 0.15s",
            }}
          >
            <span>Contact Created</span>
            <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: "center" }}>
              {journeyLoading ? "\u2026" : (selection ? selection.count : count)?.toLocaleString() ?? "\u2014"}
            </span>
            <button onClick={(e) => startConnect(CONTACT_CREATED_ID, e)} title="Connect to an automation or step"
              style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.6)", background: connecting === CONTACT_CREATED_ID ? "rgba(255,255,255,0.4)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, marginLeft: 4 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5"><path d="M5 2v6M2 5h6" /></svg>
            </button>
          </div>

        </div>

        {/* ──── AUTOMATION CANVAS ──── */}
        <div
          ref={canvasRef}
          onClick={(e) => {
            handleCanvasClick(e);
            // Clear selection on empty canvas click
            if (!(e.target as HTMLElement).closest("[data-node]") && !addMode) {
              setSelectedIds(new Set());
            }
          }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            position: "relative", width: maxX, minWidth: "100%", height: maxY,
            cursor: addMode ? "crosshair" : connecting ? "crosshair" : selRect ? "crosshair" : dragging ? "grabbing" : "default",
          }}
        >
          {/* SVG arrows */}
          <svg style={{ position: "absolute", inset: 0, width: maxX, height: maxY, pointerEvents: "none", zIndex: 1, overflow: "visible" }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#86868B" />
              </marker>
            </defs>
            {connections.map((c, i) => {
              const path = getArrowPath(c.from, c.to);
              if (!path) return null;
              return (
                <g key={i}>
                  <path d={path} fill="none" stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); setArrowMenu({ idx: i, x: e.clientX, y: e.clientY }); }}
                  />
                  <path d={path} fill="none" stroke="#86868B" strokeWidth={2} strokeDasharray="6 3" markerEnd="url(#arrowhead)" />
                </g>
              );
            })}
          </svg>

          {/* Arrow note labels (HTML for proper rendering) */}
          {connections.map((c, i) => {
            if (!c.note) return null;
            const allP = getAllPositions();
            const fp = allP.find((p) => p.id === c.from);
            const tp = allP.find((p) => p.id === c.to);
            if (!fp || !tp) return null;
            const fd2 = getNodeDims(c.from), td2 = getNodeDims(c.to);
            let midX: number, midY: number;
            if (c.from === CONTACT_CREATED_ID) {
              midX = tp.x + td2.w / 2;
              midY = tp.y / 2;
            } else if (c.to === CONTACT_CREATED_ID) {
              midX = fp.x + fd2.w / 2;
              midY = fp.y / 2;
            } else {
              midX = (fp.x + fd2.w / 2 + tp.x + td2.w / 2) / 2;
              midY = (fp.y + fd2.h / 2 + tp.y + td2.h / 2) / 2;
            }
            return (
              <div key={`note-${i}`}
                onClick={(e) => { e.stopPropagation(); setArrowMenu({ idx: i, x: e.clientX, y: e.clientY }); }}
                style={{
                  position: "absolute",
                  left: midX,
                  top: midY,
                  transform: "translate(-50%, -50%)",
                  background: "white",
                  border: "1px solid #E5E5EA",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#1D1D1F",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  zIndex: 4,
                  maxWidth: 180,
                  textAlign: "center",
                  lineHeight: 1.3,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  userSelect: "none",
                }}
              >
                {c.note}
              </div>
            );
          })}

          {/* Automation nodes */}
          {layoutLoaded && positions.map((pos) => {
            const auto = autoMap.get(pos.id);
            if (!auto) return null;
            const isConnectSource = connecting === pos.id;
            const isSelected = selectedIds.has(pos.id);
            return (
              <div key={pos.id} data-node onPointerDown={(e) => onNodePointerDown(pos.id, e)} onClick={(e) => { e.stopPropagation(); handleNodeClick(pos.id); }}
                style={{
                  position: "absolute", left: pos.x, top: pos.y, width: NODE_W, height: NODE_H,
                  background: isSelected ? "#F0F5FF" : "white",
                  border: isConnectSource ? `2px solid ${auto.color}` : isSelected ? "2px solid #0071E3" : "1px solid #E5E5EA",
                  borderLeft: `3px solid ${auto.color}`,
                  borderRadius: 10, padding: "10px 12px", cursor: connecting ? "pointer" : "grab",
                  userSelect: "none", zIndex: dragging === pos.id ? 10 : isSelected ? 3 : 2,
                  boxShadow: dragging === pos.id ? "0 8px 24px rgba(0,0,0,0.15)" : isSelected ? "0 0 0 3px rgba(0,113,227,0.2)" : isConnectSource ? `0 0 0 3px ${auto.color}30` : "0 1px 3px rgba(0,0,0,0.06)",
                  display: "flex", flexDirection: "column", justifyContent: "center", gap: 4,
                  transition: dragging === pos.id ? "none" : "box-shadow 0.15s",
                }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{auto.name}</span>
                  <button onClick={(e) => startConnect(pos.id, e)} title="Connect"
                    style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${auto.color}`, background: connecting === pos.id ? auto.color : "white", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={connecting === pos.id ? "white" : auto.color} strokeWidth="1.5"><path d="M5 2v6M2 5h6" /></svg>
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#86868B" }}>{auto.emails} email{auto.emails !== 1 ? "s" : ""}</span>
                </div>
              </div>
            );
          })}

          {/* Custom nodes (bubbles) */}
          {layoutLoaded && customNodes.map((cn) => {
            const isConnectSource = connecting === cn.id;
            const isSelected = selectedIds.has(cn.id);
            return (
              <div key={cn.id} data-node
                onPointerDown={(e) => onNodePointerDown(cn.id, e)}
                onClick={(e) => { e.stopPropagation(); if (connecting) { handleNodeClick(cn.id); } }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingCustom(cn); }}
                style={{
                  position: "absolute", left: cn.x, top: cn.y, width: CUSTOM_W,
                  minHeight: CUSTOM_H_BASE,
                  background: cn.color, color: "white",
                  borderRadius: 24, padding: "10px 18px",
                  cursor: connecting ? "pointer" : "grab",
                  userSelect: "none", zIndex: dragging === cn.id ? 10 : isSelected ? 4 : 3,
                  boxShadow: dragging === cn.id ? "0 8px 24px rgba(0,0,0,0.2)" : isSelected ? `0 0 0 4px rgba(0,113,227,0.4)` : isConnectSource ? `0 0 0 4px ${cn.color}40` : "0 2px 8px rgba(0,0,0,0.12)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  transition: dragging === cn.id ? "none" : "box-shadow 0.15s",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1, textAlign: "center", lineHeight: 1.3, wordBreak: "break-word" }}>
                    {cn.label || "Untitled"}
                  </span>
                  <button onClick={(e) => startConnect(cn.id, e)} title="Connect"
                    style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.6)", background: isConnectSource ? "rgba(255,255,255,0.4)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5"><path d="M5 2v6M2 5h6" /></svg>
                  </button>
                </div>
                {cn.notes && (
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", textAlign: "center" }}>
                    {cn.notes}
                  </span>
                )}
              </div>
            );
          })}

          {/* Rubber-band selection rectangle */}
          {selRect && (() => {
            const x = Math.min(selRect.x1, selRect.x2);
            const y = Math.min(selRect.y1, selRect.y2);
            const w = Math.abs(selRect.x2 - selRect.x1);
            const h = Math.abs(selRect.y2 - selRect.y1);
            if (w < 3 && h < 3) return null;
            return (
              <div style={{
                position: "absolute", left: x, top: y, width: w, height: h,
                background: "rgba(0,113,227,0.08)", border: "1.5px solid rgba(0,113,227,0.4)",
                borderRadius: 3, pointerEvents: "none", zIndex: 50,
              }} />
            );
          })()}
        </div>
      </div>

      {/* ════════════ CONNECTIONS BAR ════════════ */}
      {connections.length > 0 && (
        <div style={{ borderTop: "1px solid #E5E5EA", background: "rgba(255,255,255,0.95)", padding: "8px 20px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
          <span style={{ fontWeight: 600, color: "#86868B" }}>Connections:</span>
          {connections.map((c, i) => (
            <span key={i} style={{ background: "#F2F2F7", padding: "3px 8px", borderRadius: 999, color: "#1D1D1F", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {getNodeLabel(c.from)} {"\u2192"} {getNodeLabel(c.to)}
              {c.note && <span style={{ color: "#86868B", fontStyle: "italic" }}>({c.note})</span>}
              <button onClick={() => removeConnection(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D93D42", fontWeight: 700, fontSize: 12, padding: "0 2px", lineHeight: 1 }} title="Remove">{"\u00D7"}</button>
            </span>
          ))}
        </div>
      )}

      {/* ════════════ ARROW CONTEXT MENU ════════════ */}
      {arrowMenu && (() => {
        const c = connections[arrowMenu.idx];
        if (!c) return null;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setArrowMenu(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              position: "fixed", left: arrowMenu.x, top: arrowMenu.y,
              background: "white", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              border: "1px solid #E5E5EA", minWidth: 180, padding: "6px 0", zIndex: 201,
            }}>
              <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 600, color: "#86868B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {getNodeLabel(c.from)} {"\u2192"} {getNodeLabel(c.to)}
              </div>
              <button onClick={() => { setArrowMenu(null); setArrowNoteEdit({ idx: arrowMenu.idx, note: c.note ?? "" }); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#1D1D1F", fontFamily: "inherit", textAlign: "left" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#F2F2F7"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" /></svg>
                {c.note ? "Edit note" : "Add note"}
              </button>
              {c.note && (
                <button onClick={() => {
                  const updated = connections.map((conn, j) => j === arrowMenu.idx ? { ...conn, note: undefined } : conn);
                  setConnections(updated);
                  persistLayout(positions, updated, customNodes);
                  setArrowMenu(null);
                }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#1D1D1F", fontFamily: "inherit", textAlign: "left" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#F2F2F7"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5z" /><path d="M2 22l1-3" /></svg>
                  Remove note
                </button>
              )}
              <div style={{ height: 1, background: "#E5E5EA", margin: "4px 0" }} />
              <button onClick={() => { removeConnection(arrowMenu.idx); setArrowMenu(null); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#D93D42", fontFamily: "inherit", textAlign: "left" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#FCE6E7"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                Delete connection
              </button>
            </div>
          </div>
        );
      })()}

      {/* ════════════ ARROW NOTE EDITOR ════════════ */}
      {arrowNoteEdit && (() => {
        const c = connections[arrowNoteEdit.idx];
        if (!c) return null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setArrowNoteEdit(null)}>
            <form onSubmit={(e) => {
              e.preventDefault();
              const updated = connections.map((conn, j) => j === arrowNoteEdit.idx ? { ...conn, note: arrowNoteEdit.note.trim() || undefined } : conn);
              setConnections(updated);
              persistLayout(positions, updated, customNodes);
              setArrowNoteEdit(null);
            }} onClick={(e) => e.stopPropagation()}
              style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 600, color: "#1D1D1F" }}>Connection note</h2>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: "#86868B" }}>
                {getNodeLabel(c.from)} {"\u2192"} {getNodeLabel(c.to)}
              </p>
              <textarea
                autoFocus
                value={arrowNoteEdit.note}
                onChange={(e) => setArrowNoteEdit({ ...arrowNoteEdit, note: e.target.value })}
                placeholder="e.g. Triggers after 3 days..."
                style={{
                  width: "100%", border: "1px solid #E5E5EA", borderRadius: 8, padding: "10px 12px",
                  fontSize: 14, color: "#1D1D1F", background: "white", outline: "none", fontFamily: "inherit",
                  resize: "vertical", minHeight: 70,
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => setArrowNoteEdit(null)}
                  style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #E5E5EA", background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#1D1D1F" }}>
                  Cancel
                </button>
                <button type="submit"
                  style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0071E3", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Save
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* ════════════ CUSTOM NODE MODAL ════════════ */}
      {editingCustom && (
        <CustomNodeModal
          node={editingCustom}
          isNew={!customNodes.some((c) => c.id === editingCustom.id)}
          onSave={handleSaveCustom}
          onDelete={() => handleDeleteCustom(editingCustom.id)}
          onCancel={() => setEditingCustom(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Custom node edit modal
   ═══════════════════════════════════════════ */
function CustomNodeModal({ node, isNew, onSave, onDelete, onCancel }: {
  node: CustomNode; isNew: boolean;
  onSave: (n: CustomNode) => void; onDelete: () => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(node);

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1px solid #E5E5EA", borderRadius: 8, padding: "8px 12px",
    fontSize: 14, color: "#1D1D1F", background: "white", outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onCancel}>
      <form onSubmit={(e) => { e.preventDefault(); if (draft.label.trim()) onSave({ ...draft, label: draft.label.trim(), notes: draft.notes.trim() }); }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 600, color: "#1D1D1F" }}>
          {isNew ? "Add step" : "Edit step"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Label *</span>
            <input style={inputStyle} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="e.g. Books home visit" autoFocus />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Notes</span>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Optional notes about this step..." />
          </label>

          <div>
            <span style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Colour</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {BUBBLE_COLORS.map((c) => (
                <button key={c.value} type="button" onClick={() => setDraft((d) => ({ ...d, color: c.value }))}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: c.value, border: draft.color === c.value ? "3px solid #1D1D1F" : "2px solid transparent",
                    cursor: "pointer", padding: 0, outline: draft.color === c.value ? "2px solid white" : "none",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          <div style={{
            background: draft.color, color: "white", borderRadius: 999, padding: "10px 24px",
            fontSize: 13, fontWeight: 600, textAlign: "center", maxWidth: 200,
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}>
            {draft.label || "Preview"}
            {draft.notes && <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>{draft.notes}</div>}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
          <div>
            {!isNew && (
              <button type="button" onClick={onDelete} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#FCE6E7", color: "#D93D42", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Delete step
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #E5E5EA", background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#1D1D1F" }}>Cancel</button>
            <button type="submit" style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0071E3", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {isNew ? "Add" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
