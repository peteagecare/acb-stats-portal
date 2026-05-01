import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationPrefs, notifications } from "@/db/schema";

type NotifPrefRow = typeof notificationPrefs.$inferSelect;

/** Generic notification dispatcher. Reads recipient prefs, drops an in-app row
 *  if their `inAppKey` pref is true, and calls `sendEmail` if `emailKey` is true.
 *  Skips entirely when recipient === actor. Returns silently on any DB error so
 *  the caller's primary write isn't blocked by notification failures. */
export async function notify(opts: {
  recipientEmail: string;
  actorEmail: string;
  kind: string;
  payload: Record<string, unknown>;
  inAppKey: keyof NotifPrefRow;
  emailKey: keyof NotifPrefRow;
  noteId?: string | null;
  taskId?: string | null;
  sendEmail?: () => Promise<void> | void;
  defaultInApp?: boolean;
  defaultEmail?: boolean;
}): Promise<void> {
  const {
    recipientEmail, actorEmail, kind, payload,
    inAppKey, emailKey, noteId = null, taskId = null,
    sendEmail, defaultInApp = true, defaultEmail = true,
  } = opts;

  if (!recipientEmail) return;
  if (recipientEmail.toLowerCase() === actorEmail.toLowerCase()) return;

  let pref: NotifPrefRow | undefined;
  try {
    [pref] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userEmail, recipientEmail))
      .limit(1);
  } catch (e) {
    console.error("[notify] pref lookup failed:", e);
  }

  const wantInApp = (pref?.[inAppKey] as boolean | undefined) ?? defaultInApp;
  const wantEmail = (pref?.[emailKey] as boolean | undefined) ?? defaultEmail;

  if (wantInApp) {
    try {
      await db.insert(notifications).values({
        recipientEmail,
        kind,
        noteId,
        taskId,
        actorEmail,
        payload,
      });
    } catch (e) {
      console.error("[notify] insert failed:", e);
    }
  }

  if (wantEmail && sendEmail) {
    try {
      await sendEmail();
    } catch (e) {
      console.error("[notify] email failed:", e);
    }
  }
}

export function getOriginFromRequest(request: Request | { url: string }): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
