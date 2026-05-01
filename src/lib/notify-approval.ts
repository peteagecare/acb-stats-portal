import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationPrefs, notifications } from "@/db/schema";
import { loadUsers } from "@/lib/users";
import { sendApprovalStepEmail } from "@/lib/email";
import {
  APPROVAL_ROLES,
  APPROVAL_SEQUENCE,
  AnyApprovalKey,
  ApprovalState,
  isDnnaConfirmed,
  isFullyApproved,
} from "@/lib/approval-roles";

const PETE_EMAIL = "pete@agecare-bathrooms.co.uk";

/** Who should be notified after the latest approve/DNNA action? */
function nextRecipientsAfterApprove(state: ApprovalState): { emails: string[]; reason: string } {
  if (isFullyApproved(state)) {
    return { emails: [PETE_EMAIL], reason: "fully approved" };
  }
  // DNNA path: Pete marked it; Chris needs to confirm.
  if (state.dnna_pete && !state.dnna_chris) {
    const chris = APPROVAL_ROLES.find((r) => r.key === "chris");
    return { emails: chris?.allowedEmails ?? [], reason: "needs DNNA confirmation" };
  }
  // Normal sequential workflow: find first step not yet done.
  for (const step of APPROVAL_SEQUENCE) {
    const allDone = step.every((r) => !!state[r]);
    if (allDone) continue;
    const emails: string[] = [];
    for (const roleKey of step) {
      if (state[roleKey]) continue;
      const cfg = APPROVAL_ROLES.find((r) => r.key === roleKey);
      if (cfg) emails.push(...cfg.allowedEmails);
    }
    return { emails: [...new Set(emails)], reason: "next approver" };
  }
  return { emails: [], reason: "" };
}

/**
 * Fire an in-app notification + email when an approval step changes —
 * after someone approves, the next person is notified; after a rejection,
 * Pete is notified that the email was sent back for changes.
 */
export async function notifyApprovalStep(opts: {
  emailId: string;
  itemTitle: string;
  itemKind: string;
  itemUrl: string;
  actorEmail: string;
  actorLabel: string;
  state: ApprovalState;
  action: "approve" | "reject";
  rejectionNote?: string;
  origin: string;
}): Promise<void> {
  const { emailId, itemTitle, itemKind, itemUrl, actorEmail, actorLabel, state, action, rejectionNote, origin } = opts;

  let recipients: string[];
  let summaryAction: string;
  if (action === "reject") {
    recipients = [PETE_EMAIL];
    summaryAction = "sent back for changes";
  } else if (isFullyApproved(state) || isDnnaConfirmed(state)) {
    // Final step done — let Pete know it's good to go.
    recipients = [PETE_EMAIL];
    summaryAction = "fully approved";
  } else {
    const next = nextRecipientsAfterApprove(state);
    recipients = next.emails;
    summaryAction = "approved — your turn";
  }

  // Don't notify the actor about their own action.
  recipients = recipients.filter((e) => e.toLowerCase() !== actorEmail.toLowerCase());
  if (recipients.length === 0) return;

  const users = await loadUsers();
  const fullLink = `${origin}${itemUrl}`;

  for (const recipientEmail of recipients) {
    const recipient = users.find((u) => u.email.toLowerCase() === recipientEmail.toLowerCase());
    const recipientLabel = recipient?.label ?? recipientEmail;

    const [pref] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userEmail, recipientEmail))
      .limit(1);
    // Reuse mentions/task prefs as a sensible default (existing prefs don't have an
    // approval-specific column yet); user can still mute by clearing those columns.
    const wantInApp = pref?.financeApprovalInApp ?? true;
    const wantEmail = pref?.financeApprovalEmail ?? true;

    if (wantInApp) {
      await db.insert(notifications).values({
        recipientEmail,
        kind: action === "reject" ? "finance_approval_rejected" : "finance_approval_step",
        noteId: null,
        taskId: null,
        actorEmail,
        payload: {
          actorLabel,
          itemTitle,
          itemKind,
          itemUrl,
          summary: summaryAction,
          rejectionNote: rejectionNote ?? null,
        },
      }).catch(() => {});
    }

    if (wantEmail) {
      sendApprovalStepEmail({
        to: recipientEmail,
        recipientLabel,
        actorLabel,
        action,
        itemTitle,
        itemKind,
        rejectionNote: rejectionNote ?? null,
        link: fullLink,
      }).catch(() => {});
    }
  }
}
