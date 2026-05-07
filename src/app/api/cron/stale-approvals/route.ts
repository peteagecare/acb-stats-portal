import { NextRequest } from "next/server";
import { loadJson } from "@/lib/blob-store";
import { isAuthorisedCron } from "@/lib/cron-auth";
import {
  APPROVAL_ROLES,
  AnyApprovalKey,
  ApprovalState,
  isFullyApproved,
  pendingActionsForUser,
} from "@/lib/approval-roles";
import { sendApprovalStepEmail } from "@/lib/email";
import { notify } from "@/lib/notify";

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
type EntryApprovals = Partial<Record<AnyApprovalKey, ApprovalRecord>> & { rejection?: RejectionRecord };
type ApprovalsStore = Record<string, EntryApprovals>;

interface ContentItem { id: string; title: string; type: string; }
interface CalendarEntry { id: string; title: string; platform?: string; platforms?: string[]; needsFinanceApproval: boolean; }
interface HubSpotEmail { id: string; subject?: string; name?: string; }

const STALE_DAYS = 5;

function recordToState(rec: EntryApprovals): ApprovalState {
  return {
    pete: !!rec.pete?.approved,
    chris: !!rec.chris?.approved,
    sam: !!rec.sam?.approved,
    outside: !!rec.outside?.approved,
    dnna_pete: !!rec.dnna_pete?.approved,
    dnna_chris: !!rec.dnna_chris?.approved,
    rejected: !!rec.rejection,
  };
}

function ageDays(timestamps: (string | undefined)[]): number {
  const valid = timestamps.filter((t): t is string => !!t).map((t) => new Date(t).getTime()).filter((t) => !Number.isNaN(t));
  if (valid.length === 0) return 0;
  const newest = Math.max(...valid);
  return Math.floor((Date.now() - newest) / (24 * 60 * 60 * 1000));
}

export async function GET(request: NextRequest) {
  if (!isAuthorisedCron(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin = request.nextUrl.origin;

  const [approvals, contentItems, calendarItems, emailsResp] = await Promise.all([
    loadJson<ApprovalsStore>("approvals.json", "./approvals.json", {}),
    loadJson<ContentItem[]>("content-items.json", "./content-items.json", []),
    loadJson<CalendarEntry[]>("content-calendar.json", "./content-calendar.json", []),
    fetch(`${origin}/api/hubspot/emails-list`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      cache: "no-store",
    }).then((r) => r.ok ? r.json() : { emails: [] }).catch(() => ({ emails: [] })),
  ]);

  const emails: HubSpotEmail[] = emailsResp?.emails ?? [];
  const sent: { id: string; recipientEmail: string; ageDays: number }[] = [];

  for (const [id, rec] of Object.entries(approvals)) {
    if (!rec) continue;
    const state = recordToState(rec);
    if (isFullyApproved(state)) continue;

    const stamps = [
      rec.pete?.timestamp, rec.chris?.timestamp, rec.sam?.timestamp,
      rec.outside?.timestamp, rec.dnna_pete?.timestamp, rec.dnna_chris?.timestamp,
      rec.rejection?.timestamp,
    ];
    const days = ageDays(stamps);
    if (days < STALE_DAYS) continue;

    // Resolve item details for the email
    let itemTitle = "an item";
    let itemKind = "Approval";
    let itemUrl = "/financial-approvals";
    const ci = contentItems.find((c) => c.id === id);
    const ce = calendarItems.find((c) => c.id === id && c.needsFinanceApproval);
    const em = emails.find((e) => e.id === id);
    if (ci) { itemTitle = ci.title; itemKind = ci.type.charAt(0).toUpperCase() + ci.type.slice(1); }
    else if (ce) {
      itemTitle = ce.title;
      itemKind = Array.isArray(ce.platforms) && ce.platforms.length ? ce.platforms.join(", ") : (ce.platform ?? "");
      itemUrl = "/content-calendar";
    }
    else if (em) { itemTitle = em.subject || em.name || "Email"; itemKind = "Email"; }

    // Find the role that's blocking and notify the actual humans for that role
    let blockerEmails: string[] = [];
    if (state.dnna_pete && !state.dnna_chris) {
      blockerEmails = APPROVAL_ROLES.find((r) => r.key === "chris")?.allowedEmails ?? [];
    } else {
      // First incomplete step in the sequence
      for (const step of [["pete"], ["chris"], ["sam"], ["outside"]] as AnyApprovalKey[][]) {
        const allDone = step.every((k) => !!state[k]);
        if (allDone) continue;
        const need = step.filter((k) => !state[k]);
        blockerEmails = need.flatMap((k) => APPROVAL_ROLES.find((r) => r.key === k)?.allowedEmails ?? []);
        break;
      }
    }
    blockerEmails = [...new Set(blockerEmails)];

    for (const recipientEmail of blockerEmails) {
      await notify({
        recipientEmail,
        actorEmail: "system@portal",
        kind: "stale_approval",
        payload: {
          itemTitle,
          itemKind,
          itemUrl,
          summary: `Pending ${days} days`,
        },
        inAppKey: "staleApprovalInApp",
        emailKey: "staleApprovalEmail",
        sendEmail: () => sendApprovalStepEmail({
          to: recipientEmail,
          recipientLabel: recipientEmail.split("@")[0],
          actorLabel: "Marketing Hub",
          action: "approve",
          itemTitle: `${itemTitle} (waiting ${days} days)`,
          itemKind,
          rejectionNote: null,
          link: `${origin}${itemUrl}`,
        }),
      });
      sent.push({ id, recipientEmail, ageDays: days });
    }
  }

  return Response.json({ ok: true, sent: sent.length, items: sent });
}
