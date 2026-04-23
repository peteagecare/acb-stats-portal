"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  APPROVAL_ROLES,
  ApprovalRole,
  AnyApprovalKey,
  canApprove,
  canApproveAny,
  pendingActionsForUser,
  PendingAction,
  isDnnaConfirmed,
} from "@/lib/approval-roles";

interface HubSpotEmail {
  id: string;
  name: string;
  subject: string;
  state: string;
  type: string;
  publishDate: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  isPublished: boolean;
}

interface ApprovalRecord {
  approved: boolean;
  userEmail: string;
  userLabel: string;
  timestamp: string;
}

interface RejectionRecord {
  byRole: AnyApprovalKey;
  userEmail: string;
  userLabel: string;
  note: string;
  timestamp: string;
}

type EmailApprovals = Partial<Record<AnyApprovalKey, ApprovalRecord>> & {
  rejection?: RejectionRecord;
};

type ApprovalsMap = Record<string, EmailApprovals>;

interface WorkflowRef {
  id: string;
  name: string;
  enabled: boolean;
}

type WorkflowMap = Record<string, WorkflowRef[]>;

interface SessionInfo {
  email: string | null;
  role: "admin" | "viewer";
}

const STATE_GROUPS: { key: string; label: string; states: string[]; color: string; bg: string }[] = [
  { key: "SCHEDULED", label: "Scheduled", states: ["SCHEDULED"], color: "#0071E3", bg: "#EBF5FF" },
  { key: "AUTOMATED", label: "Automated (inside workflows)", states: ["AUTOMATED", "AUTOMATED_DRAFT", "AUTOMATED_SENDING", "AUTOMATED_SENT"], color: "#8E4EC6", bg: "#F5EDFF" },
  { key: "DRAFT", label: "Drafts", states: ["DRAFT"], color: "#F59E0B", bg: "#FEF7E7" },
  { key: "PUBLISHED", label: "Published / Sent", states: ["PUBLISHED", "PUBLISHED_OR_SCHEDULED", "PUBLISHED_AB", "PUBLISHED_AB_VARIANT", "SENT"], color: "#30A46C", bg: "#E8F7EF" },
  { key: "OTHER", label: "Other", states: [], color: "#86868B", bg: "#F5F5F7" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stateToGroup(state: string): string {
  for (const g of STATE_GROUPS) {
    if (g.states.includes(state)) return g.key;
  }
  return "OTHER";
}

function kindBadge(type: string): { label: string; color: string; bg: string } {
  const t = (type || "").toUpperCase();
  if (t === "AUTOMATED_EMAIL" || t === "FOLLOWUP_EMAIL") return { label: "Automation", color: "#8E4EC6", bg: "#F5EDFF" };
  if (t === "AB_EMAIL") return { label: "A/B test", color: "#0071E3", bg: "#EBF5FF" };
  if (t === "BLOG_EMAIL" || t === "RSS_EMAIL") return { label: t === "BLOG_EMAIL" ? "Blog" : "RSS", color: "#F59E0B", bg: "#FEF7E7" };
  if (t === "BATCH_EMAIL") return { label: "One-off", color: "#30A46C", bg: "#E8F7EF" };
  return { label: type || "Other", color: "#86868B", bg: "#F5F5F7" };
}

export default function FinancialApprovalsPage() {
  const [emails, setEmails] = useState<HubSpotEmail[]>([]);
  const [approvals, setApprovals] = useState<ApprovalsMap>({});
  const [workflowMap, setWorkflowMap] = useState<WorkflowMap>({});
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [previewEmailId, setPreviewEmailId] = useState<string | null>(null);
  const [advanceFromId, setAdvanceFromId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["approved-by-me"]));
  const [waitingFilter, setWaitingFilter] = useState<ApprovalRole | "all">("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emailsRes, approvalsRes, meRes, wfMapRes] = await Promise.all([
        fetch("/api/hubspot/emails-list", { cache: "no-store" }),
        fetch("/api/approvals"),
        fetch("/api/auth/me"),
        fetch("/api/hubspot/email-workflow-map"),
      ]);
      if (!emailsRes.ok) throw new Error(`emails: ${emailsRes.status}`);
      if (!approvalsRes.ok) throw new Error(`approvals: ${approvalsRes.status}`);
      if (!meRes.ok) throw new Error(`me: ${meRes.status}`);

      const emailsData = await emailsRes.json();
      const approvalsData = await approvalsRes.json();
      const meData = await meRes.json();
      const wfMapData = wfMapRes.ok ? await wfMapRes.json() : { byEmailId: {} };

      if (emailsData.error) throw new Error(emailsData.error);

      setEmails(emailsData.emails ?? []);
      setApprovals(approvalsData.approvals ?? {});
      setWorkflowMap(wfMapData.byEmailId ?? {});
      setSession({ email: meData.email, role: meData.role });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleApproval(emailId: string, role: AnyApprovalKey, next: boolean) {
    const saveKey = `${emailId}:${role}`;
    setSavingKey(saveKey);
    const prev = approvals;
    setApprovals((cur) => {
      const copy = { ...cur };
      const rec = { ...(copy[emailId] ?? {}) };
      if (next) {
        rec[role] = {
          approved: true,
          userEmail: session?.email ?? "",
          userLabel: session?.email ?? "",
          timestamp: new Date().toISOString(),
        };
      } else {
        delete rec[role];
        if (role === "dnna_pete") delete rec.dnna_chris;
      }
      if (Object.keys(rec).length === 0) delete copy[emailId];
      else copy[emailId] = rec;
      return copy;
    });

    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, role, approved: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      setApprovals((cur) => {
        const copy = { ...cur };
        const rec = { ...(copy[emailId] ?? {}) };
        if (body.record) rec[role] = body.record;
        else {
          delete rec[role];
          if (role === "dnna_pete") delete rec.dnna_chris;
        }
        if (Object.keys(rec).length === 0) delete copy[emailId];
        else copy[emailId] = rec;
        return copy;
      });
    } catch (e) {
      setApprovals(prev);
      alert(`Failed to save approval: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSavingKey(null);
    }
  }

  async function rejectWithNote(emailId: string, role: AnyApprovalKey, note: string) {
    if (!note.trim()) return; // Empty note = signal to open annotation panel (handled by modal)
    const saveKey = `${emailId}:reject`;
    setSavingKey(saveKey);
    const prev = approvals;
    setApprovals((cur) => {
      const copy = { ...cur };
      copy[emailId] = {
        rejection: {
          byRole: role,
          userEmail: session?.email ?? "",
          userLabel: session?.email ?? "",
          note,
          timestamp: new Date().toISOString(),
        },
      };
      return copy;
    });
    try {
      const res = await fetch("/api/approvals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, role, note }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      setApprovals((cur) => {
        const copy = { ...cur };
        copy[emailId] = { rejection: body.rejection };
        return copy;
      });
    } catch (e) {
      setApprovals(prev);
      alert(`Failed to send back: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSavingKey(null);
    }
  }

  /** Which roles is this email currently waiting on? (Sequential: Pete -> Chris -> Sam -> Outside) */
  const waitingOnRoles = useCallback((emailId: string): ApprovalRole[] => {
    const rec = approvals[emailId] ?? {};
    if (rec.rejection) return [];
    if (isDnnaConfirmed({ dnna_pete: !!rec.dnna_pete?.approved, dnna_chris: !!rec.dnna_chris?.approved })) return [];
    if (rec.dnna_pete?.approved && !rec.dnna_chris?.approved) return ["chris"];

    const sequence: ApprovalRole[] = ["pete", "chris", "sam", "outside"];
    for (const role of sequence) {
      if (!rec[role]?.approved) return [role];
    }
    return [];
  }, [approvals]);

  const filtered = useMemo(() => {
    let list = emails;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q)
      );
    }
    if (waitingFilter !== "all") {
      list = list.filter((e) => waitingOnRoles(e.id).includes(waitingFilter));
    }
    return list;
  }, [emails, query, waitingFilter, waitingOnRoles]);

  const grouped = useMemo(() => {
    const out: Record<string, HubSpotEmail[]> = {};
    for (const g of STATE_GROUPS) out[g.key] = [];
    for (const e of filtered) {
      const k = stateToGroup(e.state);
      out[k].push(e);
    }
    return out;
  }, [filtered]);

  const totals = useMemo(() => {
    const counts: Record<ApprovalRole, number> = { pete: 0, chris: 0, sam: 0, outside: 0 };
    for (const emailId of Object.keys(approvals)) {
      for (const role of APPROVAL_ROLES) {
        if (approvals[emailId]?.[role.key]?.approved) counts[role.key] += 1;
      }
    }
    return counts;
  }, [approvals]);

  const dnnaCounts = useMemo(() => {
    let pending = 0;
    let confirmed = 0;
    for (const emailId of Object.keys(approvals)) {
      const rec = approvals[emailId];
      const pete = !!rec?.dnna_pete?.approved;
      const chris = !!rec?.dnna_chris?.approved;
      if (pete && chris) confirmed += 1;
      else if (pete) pending += 1;
    }
    return { pending, confirmed };
  }, [approvals]);

  const totalEmails = emails.length;

  const pendingByEmail = useMemo(() => {
    const out: Record<string, PendingAction[]> = {};
    for (const e of filtered) {
      const rec = approvals[e.id];
      const state: Partial<Record<AnyApprovalKey, boolean>> & { rejected?: boolean } = {};
      for (const r of APPROVAL_ROLES) state[r.key] = !!rec?.[r.key]?.approved;
      state.dnna_pete = !!rec?.dnna_pete?.approved;
      state.dnna_chris = !!rec?.dnna_chris?.approved;
      state.rejected = !!rec?.rejection;
      out[e.id] = pendingActionsForUser(session?.email, state);
    }
    return out;
  }, [filtered, approvals, session?.email]);

  const awaitingMe = useMemo(
    () => filtered.filter((e) => (pendingByEmail[e.id]?.length ?? 0) > 0),
    [filtered, pendingByEmail]
  );

  const approvedByMe = useMemo(() => {
    const me = session?.email?.toLowerCase();
    if (!me) return [];
    const awaitingIds = new Set(awaitingMe.map((e) => e.id));
    const keys: AnyApprovalKey[] = ["pete", "chris", "sam", "outside", "dnna_pete", "dnna_chris"];
    return filtered.filter((e) => {
      if (awaitingIds.has(e.id)) return false;
      const rec = approvals[e.id];
      if (!rec) return false;
      return keys.some((k) => rec[k]?.approved && rec[k]?.userEmail?.toLowerCase() === me);
    });
  }, [filtered, approvals, awaitingMe, session?.email]);

  const approvalDenominator = Math.max(0, emails.length - dnnaCounts.confirmed - dnnaCounts.pending);

  useEffect(() => {
    if (!advanceFromId) return;
    const next = awaitingMe.find((e) => e.id !== advanceFromId);
    console.log("[auto-advance]", { from: advanceFromId, awaitingCount: awaitingMe.length, nextId: next?.id ?? null });
    setPreviewEmailId(next ? next.id : null);
    setAdvanceFromId(null);
  }, [awaitingMe, advanceFromId]);

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F7" }}>
      <header
        style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          padding: "0 16px",
          position: "sticky",
          top: 0,
          zIndex: 200,
        }}
      >
        <div
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "56px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Image src="/acb-logo.png" alt="ACB" height={28} width={100} style={{ objectFit: "contain" }} />
            <div>
              <h1 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "#1D1D1F", letterSpacing: "-0.3px" }}>
                Financial Approvals
              </h1>
              <p style={{ fontSize: "10px", margin: 0, color: "#86868B" }}>Email sign-off trail</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.04)", borderRadius: "12px", padding: "0 12px", gap: "8px", minWidth: "260px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                <circle cx="11" cy="11" r="7" stroke="#1D1D1F" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="#1D1D1F" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search name or subject…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, border: "none", background: "transparent", fontSize: "13px", color: "#1D1D1F", padding: "10px 0", outline: "none" }}
              />
            </div>
            <button
              onClick={loadData}
              style={{
                fontSize: "12px",
                padding: "8px 14px",
                borderRadius: "12px",
                border: "none",
                background: "rgba(0,0,0,0.04)",
                cursor: "pointer",
                color: "#1D1D1F",
                fontWeight: 500,
              }}
            >
              Refresh
            </button>
            <Link
              href="/"
              style={{ fontSize: "12px", color: "#0071E3", textDecoration: "none", fontWeight: 500, padding: "8px 4px" }}
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "16px" }}>
        {/* Waiting-on filter */}
        {!loading && !error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: 4 }}>Filter:</span>
            {([{ key: "all" as const, label: "All emails" }, ...APPROVAL_ROLES.map((r) => ({ key: r.key, label: `Waiting on ${r.label.split(" (")[0]}` }))] as const).map((f) => {
              const active = waitingFilter === f.key;
              return (
                <button key={f.key} onClick={() => setWaitingFilter(active ? "all" : f.key)}
                  style={{
                    fontSize: 11, fontWeight: active ? 600 : 400, padding: "5px 12px", borderRadius: 999,
                    border: active ? "1.5px solid #0071E3" : "1px solid #E5E5EA",
                    background: active ? "rgba(0,113,227,0.08)" : "white",
                    color: active ? "#0071E3" : "#1D1D1F",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Signed-in banner */}
        {session?.email && (
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "16px 20px",
              marginBottom: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.04)",
              fontSize: "13px",
              color: "#3A3A3C",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#86868B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Signed in</span>
            <span style={{ fontWeight: 600, color: "#1D1D1F" }}>{session.email}</span>
            <span style={{ color: "#86868B" }}>· You can only tick your own approvals.</span>
            {session.email.toLowerCase() === "chris@agecare-bathrooms.co.uk" && (
              <span style={{ color: "#86868B" }}>
                You also tick <strong style={{ color: "#1D1D1F" }}>Outside Approval</strong> on behalf of the finance institution.
              </span>
            )}
          </div>
        )}

        {/* Stat strip */}
        {!loading && !error && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <StatCard label="Total emails" value={totalEmails} tone="#1D1D1F" bg="white" />
            {APPROVAL_ROLES.map((r) => (
              <StatCard
                key={r.key}
                label={r.label}
                value={`${totals[r.key]} / ${approvalDenominator}`}
                tone="#30A46C"
                bg="white"
              />
            ))}
            {(dnnaCounts.pending > 0 || dnnaCounts.confirmed > 0) && (
              <StatCard
                label="No financial approval needed"
                value={dnnaCounts.pending > 0 ? `${dnnaCounts.confirmed} confirmed · ${dnnaCounts.pending} awaiting Chris` : `${dnnaCounts.confirmed}`}
                tone="#92400E"
                bg="#FFFBEB"
              />
            )}
          </div>
        )}

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

        {/* Loading */}
        {loading ? (
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "48px",
              textAlign: "center",
              color: "#86868B",
              fontSize: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            Loading emails…
          </div>
        ) : (
          <>
            {/* Awaiting your approval */}
            {awaitingMe.length > 0 && (() => {
              const collapsed = collapsedSections.has("awaiting");
              return (
                <section
                  style={{
                    background: "white",
                    borderRadius: "20px",
                    padding: collapsed ? "0" : "20px",
                    marginBottom: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    border: "2px solid #F59E0B",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setCollapsedSections((prev) => { const next = new Set(prev); next.has("awaiting") ? next.delete("awaiting") : next.add("awaiting"); return next; })}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px", width: "100%",
                      padding: collapsed ? "16px 20px" : "0 0 16px 0",
                      background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "white", background: "#F59E0B", borderRadius: "6px", padding: "4px 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Awaiting your approval
                    </span>
                    <span style={{ fontSize: "12px", color: "#86868B" }}>
                      {awaitingMe.length} email{awaitingMe.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {!collapsed && (
                    <EmailsTable
                      emails={awaitingMe}
                      approvals={approvals}
                      session={session}
                      savingKey={savingKey}
                      onToggle={toggleApproval}
                      onPreview={setPreviewEmailId}
                      pendingByEmail={pendingByEmail}
                      workflowMap={workflowMap}
                    />
                  )}
                </section>
              );
            })()}

            {approvedByMe.length > 0 && (() => {
              const collapsed = collapsedSections.has("approved-by-me");
              return (
                <section
                  style={{
                    background: "white",
                    borderRadius: "20px",
                    padding: collapsed ? "0" : "20px",
                    marginBottom: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    border: "2px solid #30A46C",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setCollapsedSections((prev) => { const next = new Set(prev); next.has("approved-by-me") ? next.delete("approved-by-me") : next.add("approved-by-me"); return next; })}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px", width: "100%",
                      padding: collapsed ? "16px 20px" : "0 0 16px 0",
                      background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "white", background: "#30A46C", borderRadius: "6px", padding: "4px 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      You&apos;ve approved
                    </span>
                    <span style={{ fontSize: "12px", color: "#86868B" }}>
                      {approvedByMe.length} email{approvedByMe.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {!collapsed && (
                    <EmailsTable
                      emails={approvedByMe}
                      approvals={approvals}
                      session={session}
                      savingKey={savingKey}
                      onToggle={toggleApproval}
                      onPreview={setPreviewEmailId}
                      pendingByEmail={pendingByEmail}
                      workflowMap={workflowMap}
                    />
                  )}
                </section>
              );
            })()}

            {STATE_GROUPS.map((group) => {
            const groupEmails = grouped[group.key] ?? [];
            if (groupEmails.length === 0) return null;
            const collapsed = collapsedSections.has(group.key);
            return (
              <section
                key={group.key}
                style={{
                  background: "white",
                  borderRadius: "20px",
                  padding: collapsed ? "0" : "20px",
                  marginBottom: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  border: "1px solid rgba(0,0,0,0.04)",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setCollapsedSections((prev) => { const next = new Set(prev); next.has(group.key) ? next.delete(group.key) : next.add(group.key); return next; })}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", width: "100%",
                    padding: collapsed ? "16px 20px" : "0 0 16px 0",
                    background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: group.color, background: group.bg, borderRadius: "6px", padding: "4px 10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {group.label}
                  </span>
                  <span style={{ fontSize: "12px", color: "#86868B" }}>{groupEmails.length} email{groupEmails.length === 1 ? "" : "s"}</span>
                </button>
                {!collapsed && (
                  <EmailsTable
                    emails={groupEmails}
                    approvals={approvals}
                    session={session}
                    savingKey={savingKey}
                    onToggle={toggleApproval}
                    onPreview={setPreviewEmailId}
                    pendingByEmail={pendingByEmail}
                    workflowMap={workflowMap}
                  />
                )}
              </section>
            );
          })}
          </>
        )}
      </main>

      {previewEmailId && (
        <EmailPreviewModal
          emailId={previewEmailId}
          onClose={() => setPreviewEmailId(null)}
          approval={approvals[previewEmailId] ?? {}}
          session={session}
          savingKey={savingKey}
          pendingActions={pendingByEmail[previewEmailId] ?? []}
          onToggle={toggleApproval}
          onReject={rejectWithNote}
          onActionTaken={(id) => setAdvanceFromId(id)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tone, bg }: { label: string; value: string | number; tone: string; bg: string }) {
  return (
    <div
      style={{
        background: bg,
        borderRadius: "20px",
        padding: "16px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <p style={{ fontSize: "10px", fontWeight: 600, color: "#86868B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </p>
      <p style={{ fontSize: "22px", fontWeight: 600, color: tone, margin: 0, letterSpacing: "-0.5px" }}>{value}</p>
    </div>
  );
}

function EmailsTable({
  emails,
  approvals,
  session,
  savingKey,
  onToggle,
  onPreview,
  pendingByEmail,
  workflowMap,
}: {
  emails: HubSpotEmail[];
  approvals: ApprovalsMap;
  session: SessionInfo | null;
  savingKey: string | null;
  onToggle: (emailId: string, role: AnyApprovalKey, next: boolean) => void;
  onPreview: (emailId: string) => void;
  pendingByEmail: Record<string, PendingAction[]>;
  workflowMap: WorkflowMap;
}) {
  // Group emails by automation/workflow name
  const groups: { name: string; emails: HubSpotEmail[] }[] = [];
  const byWf = new Map<string, HubSpotEmail[]>();
  const noWf: HubSpotEmail[] = [];

  for (const email of emails) {
    const wfs = workflowMap[email.id] ?? [];
    if (wfs.length > 0) {
      // Use first workflow name as the group key
      const wfName = wfs[0].name;
      if (!byWf.has(wfName)) byWf.set(wfName, []);
      byWf.get(wfName)!.push(email);
    } else {
      noWf.push(email);
    }
  }

  // Sort workflow groups alphabetically
  for (const [name, wfEmails] of [...byWf.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    groups.push({ name, emails: wfEmails });
  }
  if (noWf.length > 0) {
    groups.push({ name: "", emails: noWf });
  }

  // If there's only one group (or no workflows at all), skip sub-headers
  const showSubGroups = groups.length > 1 || (groups.length === 1 && groups[0].name !== "");
  const [collapsedWf, setCollapsedWf] = useState<Set<string>>(new Set());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: showSubGroups ? 4 : 10 }}>
      {groups.map((g) => {
        const gKey = g.name || "__none__";
        const isCollapsed = collapsedWf.has(gKey);
        return (
        <div key={gKey}>
          {showSubGroups && (
            <button
              onClick={() => setCollapsedWf((prev) => { const next = new Set(prev); next.has(gKey) ? next.delete(gKey) : next.add(gKey); return next; })}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "10px 0 6px", fontSize: 11, fontWeight: 600, color: "#86868B",
                background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2" style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
              {g.name ? (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8E4EC6", flexShrink: 0 }} />
                  <span style={{ color: "#8E4EC6" }}>{g.name}</span>
                  <span style={{ fontWeight: 400 }}>({g.emails.length})</span>
                </>
              ) : (
                <>
                  <span style={{ color: "#AEAEB2" }}>Standalone emails</span>
                  <span style={{ fontWeight: 400, color: "#AEAEB2" }}>({g.emails.length})</span>
                </>
              )}
              <div style={{ flex: 1, height: 1, background: "#F0F0F2" }} />
            </button>
          )}
          {!isCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {g.emails.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                approval={approvals[email.id] ?? {}}
                session={session}
                savingKey={savingKey}
                onToggle={onToggle}
                onPreview={onPreview}
                pendingActions={pendingByEmail[email.id] ?? []}
                workflows={workflowMap[email.id] ?? []}
              />
            ))}
          </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function EmailRow({
  email,
  approval,
  session,
  savingKey,
  onToggle,
  onPreview,
  pendingActions,
  workflows,
}: {
  email: HubSpotEmail;
  approval: EmailApprovals;
  session: SessionInfo | null;
  savingKey: string | null;
  onToggle: (emailId: string, role: AnyApprovalKey, next: boolean) => void;
  onPreview: (emailId: string) => void;
  pendingActions: PendingAction[];
  workflows: WorkflowRef[];
}) {
  const needsAction = pendingActions.length > 0;
  const pendingRoles: ApprovalRole[] = pendingActions.filter((a) => a.kind === "approve").map((a) => a.key as ApprovalRole);
  const dnnaPeteRec = approval.dnna_pete;
  const dnnaChrisRec = approval.dnna_chris;
  const dnnaConfirmed = isDnnaConfirmed({ dnna_pete: !!dnnaPeteRec?.approved, dnna_chris: !!dnnaChrisRec?.approved });
  const dnnaPending = !!dnnaPeteRec?.approved && !dnnaChrisRec?.approved;
  const petesDnnaMine = canApproveAny("dnna_pete", session?.email);
  const chrisDnnaMine = canApproveAny("dnna_chris", session?.email);
  const normalPathStarted = !!approval.pete?.approved;
  const myApprovalKeys: AnyApprovalKey[] = [...APPROVAL_ROLES.map((r) => r.key), "dnna_pete", "dnna_chris"] as AnyApprovalKey[];
  const iHaveActed = myApprovalKeys.some((k) => canApproveAny(k, session?.email) && !!approval[k]?.approved);
  const rejection = approval.rejection;

  const borderColor = rejection ? "#FCA5A5" : needsAction ? "#F59E0B" : iHaveActed ? "#86EFAC" : "rgba(0,0,0,0.06)";
  const leftAccent = rejection ? "#DC2626" : needsAction ? "#F59E0B" : iHaveActed ? "#30A46C" : "#D1D1D6";
  const k = kindBadge(email.type);
  const savingDnnaPete = savingKey === `${email.id}:dnna_pete`;
  const savingDnnaChris = savingKey === `${email.id}:dnna_chris`;

  // Build the CTA buttons for the right side
  const ctaButtons: { label: string; bg: string; key: AnyApprovalKey; saving: boolean }[] = [];
  if (needsAction) {
    for (const a of pendingActions.filter((a) => a.kind === "approve")) {
      const cfg = APPROVAL_ROLES.find((r) => r.key === a.key);
      if (cfg) ctaButtons.push({ label: `Approve as ${cfg.label.split(" (")[0]}`, bg: "#30A46C", key: a.key, saving: savingKey === `${email.id}:${a.key}` });
    }
    if (chrisDnnaMine && dnnaPending) {
      ctaButtons.push({ label: "Approve to send", bg: "#0071E3", key: "dnna_chris", saving: savingDnnaChris });
    }
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${leftAccent}`,
        padding: 0,
        cursor: "pointer",
        transition: "box-shadow 0.15s, transform 0.1s",
        boxShadow: needsAction ? "0 2px 8px rgba(245,158,11,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex",
        overflow: "hidden",
      }}
      onClick={() => onPreview(email.id)}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = needsAction ? "0 2px 8px rgba(245,158,11,0.12)" : "0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "none"; }}
    >
      {/* Left: content */}
      <div style={{ flex: 1, minWidth: 0, padding: "16px 18px" }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1D1D1F", lineHeight: 1.3, marginBottom: 4 }}>
              {email.name}
            </div>
            {email.subject && (
              <div style={{ fontSize: 12, color: "#86868B", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {email.subject}
              </div>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2" style={{ flexShrink: 0, marginTop: 3 }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

      {/* Info pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
        <span style={{ fontSize: 10, fontWeight: 600, color: k.color, background: k.bg, borderRadius: 999, padding: "3px 9px", textTransform: "uppercase", letterSpacing: "0.3px" }}>
          {k.label}
        </span>
        <span style={{ fontSize: 10, color: "#86868B", background: "#F5F5F7", borderRadius: 999, padding: "3px 9px" }}>
          {formatDate(email.updatedAt ?? email.createdAt)}
        </span>
        {workflows.map((wf) => (
          <span key={wf.id} style={{
            fontSize: 10, color: wf.enabled ? "#065F46" : "#6B7280",
            background: wf.enabled ? "#D1FAE5" : "#F3F4F6",
            borderRadius: 999, padding: "3px 9px",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: wf.enabled ? "#10B981" : "#9CA3AF" }} />
            {wf.name}
          </span>
        ))}
        {rejection && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#991B1B", background: "#FEE2E2", borderRadius: 999, padding: "3px 9px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Sent back: {rejection.note}
          </span>
        )}
      </div>

      {/* Approvals row — visually separated */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #F0F0F2", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: "0.6px", marginRight: 4 }}>Sign-off</span>
        {APPROVAL_ROLES.map((role) => {
          const rec = approval[role.key];
          const checked = !!rec?.approved;

          if (role.key === "pete" && (dnnaPending || dnnaConfirmed) && !checked) {
            return (
              <span key={role.key} style={{
                fontSize: 11, fontWeight: 600, color: dnnaConfirmed ? "#065F46" : "#92400E",
                background: dnnaConfirmed ? "#D1FAE5" : "#FEF3C7",
                borderRadius: 8, padding: "5px 10px",
              }}>
                {dnnaConfirmed ? "\u2713 " : ""}No financial approval needed
                {petesDnnaMine && !savingDnnaPete && (
                  <button onClick={() => onToggle(email.id, "dnna_pete", false)}
                    style={{ background: "none", border: "none", color: "#86868B", cursor: "pointer", fontSize: 9, padding: "0 0 0 4px", textDecoration: "underline" }}>
                    undo
                  </button>
                )}
              </span>
            );
          }
          if (role.key === "chris" && (dnnaPending || dnnaConfirmed) && !checked) {
            if (dnnaConfirmed) {
              return <span key={role.key} style={{ fontSize: 11, fontWeight: 600, color: "#065F46", background: "#D1FAE5", borderRadius: 8, padding: "5px 10px" }}>{"\u2713"} Approved to send</span>;
            }
            if (chrisDnnaMine) {
              return (
                <button key={role.key} onClick={() => onToggle(email.id, "dnna_chris", true)} disabled={savingDnnaChris}
                  style={{ fontSize: 11, fontWeight: 600, color: "white", background: "#0071E3", borderRadius: 8, padding: "5px 12px", border: "none", cursor: savingDnnaChris ? "not-allowed" : "pointer", opacity: savingDnnaChris ? 0.5 : 1 }}>
                  Approve to send
                </button>
              );
            }
            return <span key={role.key} style={{ fontSize: 11, color: "#86868B", background: "#F5F5F7", borderRadius: 8, padding: "5px 10px" }}>Awaiting Chris</span>;
          }

          if (checked) {
            return (
              <span key={role.key} style={{
                fontSize: 11, fontWeight: 600, color: "#065F46", background: "#D1FAE5",
                borderRadius: 8, padding: "5px 10px",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                {role.label}
              </span>
            );
          }

          const isPending = pendingRoles.includes(role.key);
          return (
            <span key={role.key} style={{
              fontSize: 11, fontWeight: isPending ? 600 : 400,
              color: isPending ? "#92400E" : "#AEAEB2",
              background: isPending ? "#FFF8E7" : "#FAFAFA",
              borderRadius: 8, padding: "5px 10px",
              border: isPending ? "1.5px solid #F59E0B" : "1px solid #E5E5EA",
            }}>
              {isPending ? `Needs ${role.label}` : role.label}
            </span>
          );
        })}
      </div>

      </div>

      {/* Right: CTA panel */}
      {ctaButtons.length > 0 ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, padding: "16px 20px", minWidth: 180,
            background: "rgba(48,164,108,0.06)", borderLeft: "1px solid #E5E5EA",
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.6px" }}>Next step</span>
          {ctaButtons.map((btn) => (
            <button key={btn.key} onClick={() => onToggle(email.id, btn.key, true)} disabled={btn.saving}
              style={{
                background: btn.bg, color: "white", border: "none", borderRadius: 10, padding: "10px 18px",
                fontSize: 13, fontWeight: 600, cursor: btn.saving ? "not-allowed" : "pointer",
                opacity: btn.saving ? 0.6 : 1, width: "100%", textAlign: "center",
              }}>
              {btn.saving ? "Saving\u2026" : btn.label}
            </button>
          ))}
          {petesDnnaMine && !dnnaPeteRec?.approved && !normalPathStarted && pendingRoles.includes("pete") && (
            <button onClick={() => onToggle(email.id, "dnna_pete", true)} disabled={savingDnnaPete}
              style={{
                background: "white", color: "#1D1D1F", border: "1px solid #E5E5EA", borderRadius: 10,
                padding: "8px 14px", fontSize: 11, fontWeight: 500, cursor: savingDnnaPete ? "not-allowed" : "pointer",
                opacity: savingDnnaPete ? 0.5 : 1, width: "100%", textAlign: "center",
              }}>
              No financial approval needed
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px", minWidth: 40 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </div>
      )}
    </div>
  );
}

function ModalActionBar({
  emailId,
  approval,
  session,
  savingKey,
  pendingActions,
  onToggle,
  onReject,
}: {
  emailId: string;
  approval: EmailApprovals;
  session: SessionInfo | null;
  savingKey: string | null;
  pendingActions: PendingAction[];
  onToggle: (emailId: string, role: AnyApprovalKey, next: boolean) => void;
  onReject: (emailId: string, role: AnyApprovalKey, note: string) => void;
}) {
  if (!session?.email) return null;

  const rejection = approval.rejection;
  const dnnaPete = !!approval.dnna_pete?.approved;
  const dnnaChris = !!approval.dnna_chris?.approved;
  const dnnaConfirmed = dnnaPete && dnnaChris;
  const dnnaPending = dnnaPete && !dnnaChris;
  const petesDnnaMine = canApproveAny("dnna_pete", session.email);
  const chrisDnnaMine = canApproveAny("dnna_chris", session.email);
  const isPete = canApproveAny("pete", session.email);

  const approveActions = pendingActions.filter((a) => a.kind === "approve");
  const myApproved = APPROVAL_ROLES.filter((r) => canApprove(r.key, session.email) && approval[r.key]?.approved);

  // Role this user could use to reject — whichever role they can approve, other than Pete.
  // Chris can use "chris", Sam can use "sam". Pete doesn't reject (they're the editor).
  const rejectRole: AnyApprovalKey | null = isPete
    ? null
    : APPROVAL_ROLES.find((r) => canApprove(r.key, session.email))?.key ?? null;

  const handleReject = () => {
    if (!rejectRole) return;
    // Signal to parent modal to open the annotation/reject panel
    onReject(emailId, rejectRole, "");
  };

  // Sent back for changes — Pete sees the rejection and re-approves to restart.
  if (rejection) {
    return (
      <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#FEF2F2", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Sent back for changes
          </span>
          <span style={{ fontSize: "12px", color: "#991B1B" }}>
            by {rejection.userLabel || rejection.userEmail} · {formatDate(rejection.timestamp)}
          </span>
        </div>
        <div style={{ fontSize: "13px", color: "#450A0A", background: "white", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 12px" }}>
          &ldquo;{rejection.note}&rdquo;
        </div>
        {isPete && (
          <div>
            <button
              onClick={() => onToggle(emailId, "pete", true)}
              disabled={savingKey === `${emailId}:pete`}
              style={{ background: "#30A46C", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: savingKey === `${emailId}:pete` ? "not-allowed" : "pointer", opacity: savingKey === `${emailId}:pete` ? 0.6 : 1 }}
            >
              {savingKey === `${emailId}:pete` ? "Saving…" : "Approve revised version"}
            </button>
            <span style={{ fontSize: "11px", color: "#991B1B", marginLeft: "10px" }}>— after editing in HubSpot, approve to restart the review.</span>
          </div>
        )}
      </div>
    );
  }

  // If the email is fully handled (DNNA confirmed), show green status only.
  if (dnnaConfirmed) {
    return (
      <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#ECFDF5", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#065F46", background: "#D1FAE5", borderRadius: "6px", padding: "4px 10px" }}>
          ✓ No Financial Approval Needed
        </span>
        <span style={{ fontSize: "12px", color: "#065F46" }}>
          Marked by {approval.dnna_pete?.userLabel ?? approval.dnna_pete?.userEmail}, approved to send by {approval.dnna_chris?.userLabel ?? approval.dnna_chris?.userEmail}.
        </span>
      </div>
    );
  }

  const hasAnyAction = approveActions.length > 0 || (petesDnnaMine && !dnnaPete) || (chrisDnnaMine && dnnaPending) || myApproved.length > 0 || !!rejectRole;
  if (!hasAnyAction && !dnnaPending) return null;

  const saving = (key: AnyApprovalKey) => savingKey === `${emailId}:${key}`;

  return (
    <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#FFFBEB", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "10px", fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Your actions
      </span>

      {dnnaPending && (
        <span style={{ fontSize: "11px", color: "#92400E", background: "#FEF3C7", borderRadius: "4px", padding: "3px 8px", fontWeight: 600 }}>
          ∅ Pete marked: no financial approval needed
        </span>
      )}

      {approveActions.map((a) => {
        const cfg = APPROVAL_ROLES.find((r) => r.key === a.key);
        if (!cfg) return null;
        return (
          <button
            key={a.key}
            onClick={() => onToggle(emailId, a.key, true)}
            disabled={saving(a.key)}
            style={{
              background: "#30A46C",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: saving(a.key) ? "not-allowed" : "pointer",
              opacity: saving(a.key) ? 0.6 : 1,
            }}
          >
            {saving(a.key) ? "Saving…" : `Approve as ${cfg.label}`}
          </button>
        );
      })}

      {chrisDnnaMine && dnnaPending && (
        <button
          onClick={() => onToggle(emailId, "dnna_chris", true)}
          disabled={saving("dnna_chris")}
          style={{
            background: "#0071E3",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: saving("dnna_chris") ? "not-allowed" : "pointer",
            opacity: saving("dnna_chris") ? 0.6 : 1,
          }}
        >
          {saving("dnna_chris") ? "Saving…" : "Approved to send"}
        </button>
      )}

      {petesDnnaMine && !dnnaPete && !dnnaConfirmed && !approval.pete?.approved && (
        <button
          onClick={() => onToggle(emailId, "dnna_pete", true)}
          disabled={saving("dnna_pete")}
          style={{
            background: "white",
            color: "#1D1D1F",
            border: "1px solid #E5E5EA",
            borderRadius: "8px",
            padding: "7px 13px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: saving("dnna_pete") ? "not-allowed" : "pointer",
            opacity: saving("dnna_pete") ? 0.6 : 1,
          }}
          title="Chris will then need to approve to send"
        >
          No Financial Approval Needed
        </button>
      )}

      {rejectRole && (
        <button
          onClick={handleReject}
          disabled={savingKey === `${emailId}:reject`}
          style={{
            background: "white",
            color: "#B91C1C",
            border: "1px solid #FCA5A5",
            borderRadius: "8px",
            padding: "7px 13px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: savingKey === `${emailId}:reject` ? "not-allowed" : "pointer",
            opacity: savingKey === `${emailId}:reject` ? 0.6 : 1,
          }}
          title="Send back to Pete with a note"
        >
          ⨯ Not approved — send back
        </button>
      )}

      {myApproved.length > 0 && (
        <span style={{ fontSize: "11px", color: "#065F46", marginLeft: "auto", display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
          {myApproved.map((r) => (
            <span key={r.key} style={{ background: "#D1FAE5", borderRadius: "4px", padding: "3px 8px", fontWeight: 600 }}>
              ✓ {r.label} approved
              <button
                onClick={() => onToggle(emailId, r.key, false)}
                disabled={saving(r.key)}
                style={{ background: "transparent", border: "none", color: "#065F46", cursor: "pointer", padding: "0 0 0 6px", textDecoration: "underline", fontSize: "10px" }}
              >
                undo
              </button>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

interface EmailDetail {
  id: string;
  name: string;
  subject: string;
  state: string;
  fromName: string;
  replyTo: string;
  previewText: string;
  publishDate: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  html: string;
  widgetCount: number;
  portalId: string | null;
  uiDomain: string;
  previewKey: string | null;
  editUrl: string | null;
  previewUrl: string | null;
}

function EmailPreviewModal({
  emailId,
  onClose,
  approval,
  session,
  savingKey,
  pendingActions,
  onToggle,
  onReject,
  onActionTaken,
}: {
  emailId: string;
  onClose: () => void;
  approval: EmailApprovals;
  session: SessionInfo | null;
  savingKey: string | null;
  pendingActions: PendingAction[];
  onToggle: (emailId: string, role: AnyApprovalKey, next: boolean) => void;
  onReject: (emailId: string, role: AnyApprovalKey, note: string) => void;
  onActionTaken: (emailId: string) => void;
}) {
  const wrappedToggle = (eid: string, role: AnyApprovalKey, next: boolean) => {
    onToggle(eid, role, next);
    if (next) onActionTaken(eid);
  };
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [rejectRoleStored, setRejectRoleStored] = useState<AnyApprovalKey | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawState = useRef({ drawing: false, lastX: 0, lastY: 0 });
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const wrappedReject = (_eid: string, role: AnyApprovalKey, _note: string) => {
    // Instead of window.prompt, open the annotation panel
    setRejectRoleStored(role);
    setRejectNote("");
    setShowRejectPanel(true);
    setAnnotating(true);
  };

  function submitReject() {
    if (!rejectRoleStored || !rejectNote.trim()) return;
    // Get annotation image if any drawing was done
    const canvas = canvasRef.current;
    let annotationData: string | undefined;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasDrawing = imageData.data.some((v, i) => i % 4 === 3 && v > 0); // any non-transparent pixel
        if (hasDrawing) annotationData = canvas.toDataURL("image/png");
      }
    }
    const fullNote = annotationData
      ? `${rejectNote.trim()}\n\n[Annotated screenshot attached]`
      : rejectNote.trim();
    onReject(emailId, rejectRoleStored, fullNote);
    onActionTaken(emailId);
    setShowRejectPanel(false);
    setAnnotating(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/hubspot/email-detail?id=${encodeURIComponent(emailId)}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || body.error) {
          setError(body.error ?? `HTTP ${res.status}`);
        } else {
          setDetail(body as EmailDetail);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [emailId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hubspotEditUrl = detail?.editUrl ?? null;
  const hubspotPreviewUrl = detail?.previewUrl ?? null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "1200px",
          maxHeight: "95vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#86868B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Email preview
            </p>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#1D1D1F", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {detail?.name ?? "Loading…"}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {hubspotPreviewUrl && (
              <a
                href={hubspotPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "12px", color: "white", background: "#0071E3", textDecoration: "none", fontWeight: 500, padding: "6px 12px", borderRadius: "8px" }}
                title="Opens HubSpot's fully rendered preview (requires HubSpot login)"
              >
                HubSpot preview ↗
              </a>
            )}
            {hubspotEditUrl && (
              <a
                href={hubspotEditUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "12px", color: "#0071E3", textDecoration: "none", fontWeight: 500, padding: "6px 10px" }}
              >
                Open in HubSpot ↗
              </a>
            )}
            <button
              onClick={onClose}
              style={{ background: "#F5F5F7", border: "none", fontSize: "16px", color: "#86868B", cursor: "pointer", padding: "6px 10px", borderRadius: "10px", lineHeight: 1 }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {detail && (
          <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#FAFAFA", fontSize: "12px", color: "#3A3A3C", display: "grid", gridTemplateColumns: "auto 1fr", rowGap: "6px", columnGap: "12px" }}>
            <span style={{ color: "#86868B" }}>Subject</span>
            <span style={{ fontWeight: 500, color: "#1D1D1F" }}>{detail.subject || "—"}</span>
            {detail.previewText && (
              <>
                <span style={{ color: "#86868B" }}>Preview</span>
                <span>{detail.previewText}</span>
              </>
            )}
            {detail.fromName && (
              <>
                <span style={{ color: "#86868B" }}>From</span>
                <span>{detail.fromName}{detail.replyTo ? ` · ${detail.replyTo}` : ""}</span>
              </>
            )}
            <span style={{ color: "#86868B" }}>State</span>
            <span>{detail.state}</span>
            <span style={{ color: "#86868B" }}>Updated</span>
            <span>{formatDate(detail.updatedAt ?? detail.createdAt)}</span>
          </div>
        )}

        <ModalActionBar
          emailId={emailId}
          approval={approval}
          session={session}
          savingKey={savingKey}
          pendingActions={pendingActions}
          onToggle={wrappedToggle}
          onReject={wrappedReject}
        />

        {/* Approval history timeline */}
        {(() => {
          const events: { time: string; label: string; color: string; icon: string }[] = [];
          for (const role of APPROVAL_ROLES) {
            const rec = approval[role.key];
            if (rec?.approved) {
              events.push({
                time: rec.timestamp,
                label: `${rec.userLabel || rec.userEmail} approved as ${role.label}`,
                color: "#30A46C",
                icon: "\u2713",
              });
            }
          }
          if (approval.dnna_pete?.approved) {
            const rec = approval.dnna_pete;
            events.push({ time: rec.timestamp, label: `${rec.userLabel || rec.userEmail} marked as no financial approval needed`, color: "#F59E0B", icon: "\u2205" });
          }
          if (approval.dnna_chris?.approved) {
            const rec = approval.dnna_chris;
            events.push({ time: rec.timestamp, label: `${rec.userLabel || rec.userEmail} confirmed approved to send`, color: "#0071E3", icon: "\u2713" });
          }
          if (approval.rejection) {
            const rej = approval.rejection;
            events.push({ time: rej.timestamp, label: `${rej.userLabel || rej.userEmail} sent back: "${rej.note}"`, color: "#DC2626", icon: "\u2717" });
          }
          events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          if (events.length === 0) return null;
          return (
            <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "white" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Approval history</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative", paddingLeft: 18 }}>
                <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: "#E5E5EA" }} />
                {events.map((ev, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0", position: "relative" }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: "50%", background: ev.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, color: "white", fontWeight: 700, flexShrink: 0,
                      position: "absolute", left: -18, top: 8,
                      zIndex: 1,
                    }}>
                      {ev.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#1D1D1F", lineHeight: 1.4 }}>{ev.label}</div>
                      <div style={{ fontSize: 10, color: "#86868B" }}>{formatDate(ev.time)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {detail && detail.html && (
          <div style={{ padding: "8px 24px", background: "#FFFBEA", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: "11px", color: "#86868B" }}>
            Approximate preview — layout and styling may differ from the final sent email.
            {hubspotPreviewUrl ? (
              <> For the pixel-perfect version, <a href={hubspotPreviewUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0071E3", textDecoration: "none", fontWeight: 600 }}>open HubSpot preview ↗</a>.</>
            ) : hubspotEditUrl ? (
              <> For the exact version, <a href={hubspotEditUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0071E3", textDecoration: "none", fontWeight: 600 }}>open in HubSpot ↗</a>.</>
            ) : null}
          </div>
        )}
        {/* Annotation toolbar */}
        {annotating && (
          <div style={{ padding: "8px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#FEF2F2", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Draw on email</span>
            <span style={{ fontSize: 11, color: "#991B1B" }}>Click and drag to mark up the email below</span>
            <button onClick={clearCanvas} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #FCA5A5", background: "white", color: "#991B1B", cursor: "pointer", fontWeight: 600, marginLeft: "auto" }}>
              Clear drawing
            </button>
            <button onClick={() => { setAnnotating(false); setShowRejectPanel(false); clearCanvas(); }}
              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E5EA", background: "white", color: "#86868B", cursor: "pointer", fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        )}

        {/* Email preview + drawing canvas */}
        <div style={{ flex: 1, overflow: "auto", background: "#F5F5F7", display: "flex" }}>
          <div ref={previewContainerRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
            {loading && (
              <div style={{ padding: "60px", textAlign: "center", color: "#86868B", fontSize: "14px" }}>Loading email...</div>
            )}
            {error && (
              <div style={{ padding: "30px", color: "#DC2626", fontSize: "13px" }}>{error}</div>
            )}
            {detail && !error && (
              detail.html ? (
                <iframe
                  srcDoc={detail.html}
                  title="Email preview"
                  sandbox="allow-same-origin"
                  style={{ width: "100%", height: "100%", minHeight: "60vh", border: "none", background: "white" }}
                />
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#86868B", fontSize: "13px" }}>
                  No renderable content in this email{detail.widgetCount > 0 ? ` (${detail.widgetCount} widget${detail.widgetCount === 1 ? "" : "s"} with no HTML body)` : ""}.
                  {hubspotEditUrl && (
                    <div style={{ marginTop: "12px" }}>
                      <a href={hubspotEditUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0071E3", textDecoration: "none", fontWeight: 500 }}>
                        Open in HubSpot ↗
                      </a>
                    </div>
                  )}
                </div>
              )
            )}
            {/* Drawing canvas overlay */}
            {annotating && (
              <canvas
                ref={canvasRef}
                width={previewContainerRef.current?.offsetWidth ?? 800}
                height={previewContainerRef.current?.scrollHeight ?? 600}
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  cursor: "crosshair", zIndex: 10,
                }}
                onPointerDown={(e) => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const scaleX = canvas.width / rect.width;
                  const scaleY = canvas.height / rect.height;
                  drawState.current = { drawing: true, lastX: (e.clientX - rect.left) * scaleX, lastY: (e.clientY - rect.top) * scaleY };
                  canvas.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!drawState.current.drawing) return;
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  const rect = canvas.getBoundingClientRect();
                  const scaleX = canvas.width / rect.width;
                  const scaleY = canvas.height / rect.height;
                  const x = (e.clientX - rect.left) * scaleX;
                  const y = (e.clientY - rect.top) * scaleY;
                  ctx.beginPath();
                  ctx.moveTo(drawState.current.lastX, drawState.current.lastY);
                  ctx.lineTo(x, y);
                  ctx.strokeStyle = "#DC2626";
                  ctx.lineWidth = 3;
                  ctx.lineCap = "round";
                  ctx.lineJoin = "round";
                  ctx.stroke();
                  drawState.current.lastX = x;
                  drawState.current.lastY = y;
                }}
                onPointerUp={() => { drawState.current.drawing = false; }}
              />
            )}
          </div>

          {/* Reject panel — slides in from right */}
          {showRejectPanel && (
            <div style={{
              width: 320, flexShrink: 0, background: "white", borderLeft: "1px solid #E5E5EA",
              display: "flex", flexDirection: "column", padding: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#991B1B", marginBottom: 4 }}>Send back for changes</div>
              <p style={{ fontSize: 12, color: "#86868B", margin: "0 0 14px" }}>
                Draw on the email to highlight issues, then add a note for Pete.
              </p>
              <textarea
                autoFocus
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="What needs changing?"
                style={{
                  flex: 1, minHeight: 100, border: "1px solid #E5E5EA", borderRadius: 10, padding: 12,
                  fontSize: 13, color: "#1D1D1F", outline: "none", fontFamily: "inherit", resize: "none",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={() => { setShowRejectPanel(false); setAnnotating(false); clearCanvas(); }}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #E5E5EA", background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#1D1D1F" }}>
                  Cancel
                </button>
                <button onClick={submitReject} disabled={!rejectNote.trim()}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                    background: rejectNote.trim() ? "#DC2626" : "#E5E5EA",
                    color: rejectNote.trim() ? "white" : "#86868B",
                    fontSize: 13, fontWeight: 600, cursor: rejectNote.trim() ? "pointer" : "not-allowed",
                  }}>
                  Send back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
