"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

  const filtered = useMemo(() => {
    if (!query.trim()) return emails;
    const q = query.toLowerCase();
    return emails.filter(
      (e) => e.name.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q)
    );
  }, [emails, query]);

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
                value={`${totals[r.key]} / ${totalEmails}`}
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
            {awaitingMe.length > 0 && (
              <section
                style={{
                  background: "white",
                  borderRadius: "20px",
                  padding: "20px",
                  marginBottom: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  border: "2px solid #F59E0B",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "white",
                      background: "#F59E0B",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Awaiting your approval
                  </span>
                  <span style={{ fontSize: "12px", color: "#86868B" }}>
                    {awaitingMe.length} email{awaitingMe.length === 1 ? "" : "s"} need your sign-off
                  </span>
                </div>
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
              </section>
            )}

            {STATE_GROUPS.map((group) => {
            const groupEmails = grouped[group.key] ?? [];
            if (groupEmails.length === 0) return null;
            return (
              <section
                key={group.key}
                style={{
                  background: "white",
                  borderRadius: "20px",
                  padding: "20px",
                  marginBottom: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  border: "1px solid rgba(0,0,0,0.04)",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: group.color,
                      background: group.bg,
                      borderRadius: "6px",
                      padding: "4px 10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {group.label}
                  </span>
                  <span style={{ fontSize: "12px", color: "#86868B" }}>{groupEmails.length} email{groupEmails.length === 1 ? "" : "s"}</span>
                </div>
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
  return (
    <div style={{ overflowX: "auto", margin: "0 -20px", padding: "0 20px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1.6fr) minmax(140px, 1fr) minmax(190px, 1.3fr) minmax(170px, 1.2fr) 140px 140px",
          padding: "10px 4px",
          borderBottom: "1px solid #F5F5F7",
          fontSize: "10px",
          fontWeight: 600,
          color: "#86868B",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          gap: "12px",
          alignItems: "center",
          minWidth: "1120px",
        }}
      >
        <div>Email</div>
        <div>Last updated</div>
        {APPROVAL_ROLES.map((r) => (
          <div key={r.key} style={{ textAlign: "center" }}>{r.label}</div>
        ))}
      </div>
      {emails.map((email) => (
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
  // Once Pete approves normally, DNNA stops being an option.
  const normalPathStarted = !!approval.pete?.approved;
  // Did the signed-in user already contribute an action (approve or DNNA) to this email?
  const myApprovalKeys: AnyApprovalKey[] = [...APPROVAL_ROLES.map((r) => r.key), "dnna_pete", "dnna_chris"] as AnyApprovalKey[];
  const iHaveActed = myApprovalKeys.some((k) => canApproveAny(k, session?.email) && !!approval[k]?.approved);
  const rejection = approval.rejection;
  const rowBg = rejection
    ? "rgba(220,38,38,0.06)"           // sent back — red
    : needsAction
      ? "rgba(245,158,11,0.06)"        // awaiting me — orange
      : iHaveActed
        ? "rgba(48,164,108,0.06)"      // I've done my part — green
        : "transparent";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(260px, 1.6fr) minmax(140px, 1fr) minmax(190px, 1.3fr) minmax(170px, 1.2fr) 140px 140px",
        padding: "14px 4px",
        borderBottom: "1px solid #F5F5F7",
        fontSize: "13px",
        color: "#1D1D1F",
        gap: "12px",
        alignItems: "center",
        minWidth: "1120px",
        background: rowBg,
      }}
    >
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
        <button
          type="button"
          onClick={() => onPreview(email.id)}
          style={{
            minWidth: 0,
            textAlign: "left",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            {(() => {
              const k = kindBadge(email.type);
              return (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: k.color,
                    background: k.bg,
                    borderRadius: "4px",
                    padding: "2px 6px",
                    flexShrink: 0,
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                  }}
                >
                  {k.label}
                </span>
              );
            })()}
            <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#0071E3" }}>{email.name}</span>
          </div>
          {email.subject && (
            <div style={{ fontSize: "11px", color: "#86868B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
              {email.subject}
            </div>
          )}
          {rejection && (
            <div
              title={`"${rejection.note}"`}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "4px", fontSize: "11px", color: "#991B1B", background: "#FEE2E2", borderRadius: "4px", padding: "3px 8px", fontWeight: 600, maxWidth: "520px" }}
            >
              ⨯ Sent back by {rejection.userLabel || rejection.userEmail}:
              <span style={{ fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rejection.note}</span>
            </div>
          )}
          {workflows.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
              {workflows.map((wf) => (
                <span
                  key={wf.id}
                  title={wf.enabled ? "Workflow is ON" : "Workflow is OFF"}
                  style={{
                    fontSize: "10px",
                    color: wf.enabled ? "#065F46" : "#6B7280",
                    background: wf.enabled ? "#D1FAE5" : "#F3F4F6",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    maxWidth: "360px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: wf.enabled ? "#10B981" : "#9CA3AF",
                      flexShrink: 0,
                    }}
                  />
                  {wf.name} <span style={{ opacity: 0.7 }}>· {wf.enabled ? "ON" : "OFF"}</span>
                </span>
              ))}
            </div>
          )}
        </button>
      </div>
      <div style={{ fontSize: "12px", color: "#86868B" }}>{formatDate(email.updatedAt ?? email.createdAt)}</div>
      {APPROVAL_ROLES.map((role) => {
        const rec = approval[role.key];
        const checked = !!rec?.approved;
        const allowed = canApprove(role.key, session?.email) && !dnnaConfirmed && !dnnaPending;
        const saving = savingKey === `${email.id}:${role.key}`;
        const isPending = pendingRoles.includes(role.key);
        const savingDnnaPete = savingKey === `${email.id}:dnna_pete`;
        const savingDnnaChris = savingKey === `${email.id}:dnna_chris`;

        // PETE column — show DNNA pill when Pete has marked it (pending or confirmed)
        if (role.key === "pete" && (dnnaPending || dnnaConfirmed) && !checked) {
          return (
            <div key={role.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "0 4px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: dnnaConfirmed ? "#065F46" : "#92400E",
                  background: dnnaConfirmed ? "#D1FAE5" : "#FEF3C7",
                  borderRadius: "6px",
                  padding: "5px 10px",
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
                title={dnnaPeteRec ? `Marked by ${dnnaPeteRec.userLabel || dnnaPeteRec.userEmail} · ${formatDate(dnnaPeteRec.timestamp)}` : ""}
              >
                {dnnaConfirmed ? "✓" : "∅"} No financial approval needed
              </span>
              {petesDnnaMine && !savingDnnaPete && (
                <button
                  onClick={() => onToggle(email.id, "dnna_pete", false)}
                  style={{ background: "transparent", border: "none", color: "#86868B", cursor: "pointer", fontSize: "10px", padding: 0, textDecoration: "underline" }}
                  title="Remove this status"
                >
                  undo
                </button>
              )}
            </div>
          );
        }

        // CHRIS column — show DNNA confirmation state
        if (role.key === "chris" && (dnnaPending || dnnaConfirmed) && !checked) {
          if (dnnaConfirmed) {
            return (
              <div key={role.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "0 4px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#065F46",
                    background: "#D1FAE5",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                  title={dnnaChrisRec ? `Approved to send by ${dnnaChrisRec.userLabel || dnnaChrisRec.userEmail} · ${formatDate(dnnaChrisRec.timestamp)}` : ""}
                >
                  ✓ Approved to send
                </span>
              </div>
            );
          }
          // pending — Chris confirms
          return (
            <div key={role.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "0 4px" }}>
              {chrisDnnaMine ? (
                <button
                  onClick={() => onToggle(email.id, "dnna_chris", true)}
                  disabled={savingDnnaChris}
                  style={{
                    background: "#0071E3",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    cursor: savingDnnaChris ? "not-allowed" : "pointer",
                    fontSize: "11px",
                    fontWeight: 600,
                    opacity: savingDnnaChris ? 0.5 : 1,
                  }}
                >
                  Approve to send
                </button>
              ) : (
                <span style={{ fontSize: "11px", color: "#86868B", textAlign: "center", lineHeight: 1.3 }}>
                  Awaiting Chris<br />to approve to send
                </span>
              )}
            </div>
          );
        }

        return (
          <div key={role.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                border: checked ? "none" : "1.5px solid " + (isPending ? "#F59E0B" : allowed ? "#D2D2D7" : "#E5E5EA"),
                background: checked ? "#30A46C" : isPending ? "#FFF8E7" : "white",
                cursor: allowed && !saving ? "pointer" : "not-allowed",
                opacity: saving ? 0.5 : 1,
                transition: "all 0.15s",
                position: "relative",
                boxShadow: isPending ? "0 0 0 3px rgba(245,158,11,0.2)" : "none",
              }}
              title={
                !allowed
                  ? `Only ${role.label} can tick this`
                  : checked
                    ? `Approved by ${rec?.userLabel ?? rec?.userEmail ?? ""} · ${formatDate(rec?.timestamp ?? null)} — click to remove`
                    : "Click to approve"
              }
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!allowed || saving}
                onChange={(e) => onToggle(email.id, role.key, e.target.checked)}
                style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
              />
              {checked && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </label>
            {checked && rec && (
              <div style={{ fontSize: "10px", color: "#86868B", textAlign: "center", lineHeight: 1.3 }}>
                {rec.userLabel || rec.userEmail}
                <br />
                {formatDate(rec.timestamp)}
              </div>
            )}
            {role.key === "pete" && !checked && petesDnnaMine && !normalPathStarted && (
              <button
                onClick={() => onToggle(email.id, "dnna_pete", true)}
                disabled={savingDnnaPete}
                style={{
                  background: "transparent",
                  border: "1px dashed #C7C7CC",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  cursor: savingDnnaPete ? "not-allowed" : "pointer",
                  fontSize: "10px",
                  color: "#86868B",
                  opacity: savingDnnaPete ? 0.5 : 1,
                  whiteSpace: "nowrap",
                }}
                title="Mark this email as not needing financial approval — Chris will then confirm"
              >
                ∅ No financial approval needed
              </button>
            )}
          </div>
        );
      })}
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
    const note = window.prompt("Why are you sending this back to Pete for changes?\n(Your note will be shown to Pete.)");
    if (!note || !note.trim()) return;
    onReject(emailId, rejectRole, note.trim());
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
            background: "transparent",
            color: "#92400E",
            border: "1px dashed #D97706",
            borderRadius: "8px",
            padding: "7px 13px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: saving("dnna_pete") ? "not-allowed" : "pointer",
            opacity: saving("dnna_pete") ? 0.6 : 1,
          }}
          title="Chris will then need to approve to send"
        >
          ∅ No Financial Approval Needed
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
  const wrappedReject = (eid: string, role: AnyApprovalKey, note: string) => {
    onReject(eid, role, note);
    onActionTaken(eid);
  };
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "900px",
          maxHeight: "90vh",
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
        <div style={{ flex: 1, overflow: "auto", background: "#F5F5F7" }}>
          {loading && (
            <div style={{ padding: "60px", textAlign: "center", color: "#86868B", fontSize: "14px" }}>Loading email…</div>
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
                style={{ width: "100%", height: "60vh", border: "none", background: "white" }}
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
        </div>
      </div>
    </div>
  );
}
