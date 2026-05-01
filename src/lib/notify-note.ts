import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes } from "@/db/schema";
import { loadUsers } from "@/lib/users";
import { sendNoteSharedEmail } from "@/lib/email";
import { notify } from "@/lib/notify";

/** Fire an in-app notification + email when a meeting note becomes accessible
 *  to someone new — covers both first-time access on a restricted note and
 *  newly-added users on an existing restricted note. */
export async function notifyNoteShared(opts: {
  noteId: string;
  newRecipientEmails: string[];
  actorEmail: string;
  origin: string;
}): Promise<void> {
  const { noteId, newRecipientEmails, actorEmail, origin } = opts;
  if (newRecipientEmails.length === 0) return;

  const [note] = await db
    .select({ id: meetingNotes.id, title: meetingNotes.title })
    .from(meetingNotes)
    .where(eq(meetingNotes.id, noteId))
    .limit(1);
  if (!note) return;
  const noteTitle = note.title || "Untitled meeting note";

  const users = await loadUsers();
  const actorLabel = users.find((u) => u.email === actorEmail)?.label ?? actorEmail;
  const url = `${origin}/notes?id=${noteId}`;

  for (const recipientEmail of newRecipientEmails) {
    if (recipientEmail.toLowerCase() === actorEmail.toLowerCase()) continue;
    await notify({
      recipientEmail,
      actorEmail,
      kind: "note_shared",
      payload: { actorLabel, noteTitle },
      inAppKey: "noteSharedInApp",
      emailKey: "noteSharedEmail",
      noteId,
      sendEmail: () => sendNoteSharedEmail({
        to: recipientEmail,
        actorLabel,
        noteTitle,
        url,
      }),
    });
  }
}
