import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { comments, tasks, projects, companies } from "@/db/schema";
import { loadUsers } from "@/lib/users";
import { sendCommentEmail, sendMentionEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { extractMentionEmails } from "@/lib/mentions";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Notify the parent owner + all earlier commenters when a new comment lands.
 *  Also pings every @-mentioned user using mention prefs. Mentioned users are
 *  removed from the comment_added recipient set so they get one notification,
 *  not two. Skips the actor. */
export async function notifyComment(opts: {
  parentType: "task" | "project";
  parentId: string;
  commentBody: string;
  actorEmail: string;
  origin: string;
}): Promise<void> {
  const { parentType, parentId, commentBody, actorEmail, origin } = opts;

  // Resolve the parent + breadcrumb context
  let parentTitle = "an item";
  let companyId = "";
  let companyName = "";
  let projectId = "";
  let projectName = "";
  let ownerEmail: string | null = null;
  let taskId: string | null = null;

  if (parentType === "task") {
    const [row] = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        ownerEmail: tasks.ownerEmail,
        createdByEmail: tasks.createdByEmail,
        projectId: tasks.projectId,
        projectName: projects.name,
        companyId: projects.companyId,
        companyName: companies.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(companies, eq(projects.companyId, companies.id))
      .where(eq(tasks.id, parentId))
      .limit(1);
    if (!row) return;
    parentTitle = row.title;
    ownerEmail = row.ownerEmail ?? row.createdByEmail;
    projectId = row.projectId;
    projectName = row.projectName;
    companyId = row.companyId;
    companyName = row.companyName;
    taskId = row.id;
  } else {
    const [row] = await db
      .select({
        id: projects.id,
        name: projects.name,
        ownerEmail: projects.ownerEmail,
        companyId: projects.companyId,
        companyName: companies.name,
      })
      .from(projects)
      .innerJoin(companies, eq(projects.companyId, companies.id))
      .where(eq(projects.id, parentId))
      .limit(1);
    if (!row) return;
    parentTitle = row.name;
    ownerEmail = row.ownerEmail;
    projectId = row.id;
    projectName = row.name;
    companyId = row.companyId;
    companyName = row.companyName;
  }

  // Earlier commenters on the same parent (excluding the actor's new one)
  const earlier = await db
    .select({ authorEmail: comments.authorEmail })
    .from(comments)
    .where(and(
      eq(comments.parentType, parentType),
      eq(comments.parentId, parentId),
      ne(comments.authorEmail, actorEmail),
    ));

  // Build excerpt + URL once
  const users = await loadUsers();
  const actorLabel = users.find((u) => u.email === actorEmail)?.label ?? actorEmail;
  const plainText = stripHtml(commentBody);
  const excerpt = plainText.length > 280 ? `${plainText.slice(0, 277)}…` : plainText;
  const url = parentType === "task"
    ? `${origin}/workspace/${companyId}/${projectId}?task=${taskId}`
    : `${origin}/workspace/${companyId}/${projectId}`;
  const parentUrl = url.replace(origin, "");

  // Mentions take priority — they get a "comment_mention" notification with
  // mention prefs. The actor is filtered out by `notify()` itself.
  const mentioned = new Set(
    extractMentionEmails(commentBody).map((e) => e.toLowerCase()),
  );
  mentioned.delete(actorEmail.toLowerCase());

  for (const recipientEmail of mentioned) {
    await notify({
      recipientEmail,
      actorEmail,
      kind: "comment_mention",
      payload: {
        actorLabel,
        excerpt,
        parentType,
        parentTitle,
        parentUrl,
        projectName,
        projectId,
        companyId,
        taskId,
      },
      inAppKey: "mentionsInApp",
      emailKey: "mentionsEmail",
      taskId,
      sendEmail: () => sendMentionEmail({
        to: recipientEmail,
        actorLabel,
        noteTitle: parentTitle,
        noteUrl: url,
        excerpt,
        isAssignment: false,
      }),
    });
  }

  // Comment-watchers (owner + earlier commenters), minus anyone we just
  // mention-pinged so they don't get two notifications for the same comment.
  const recipients = new Set<string>();
  if (ownerEmail) recipients.add(ownerEmail);
  for (const r of earlier) {
    if (r.authorEmail) recipients.add(r.authorEmail);
  }
  recipients.delete(actorEmail);
  for (const m of mentioned) recipients.delete(m);

  if (recipients.size === 0) return;

  for (const recipientEmail of recipients) {
    await notify({
      recipientEmail,
      actorEmail,
      kind: "comment_added",
      payload: {
        actorLabel,
        excerpt,
        parentType,
        parentTitle,
        parentUrl,
        projectName,
        projectId,
        companyId,
        taskId,
      },
      inAppKey: "commentInApp",
      emailKey: "commentEmail",
      taskId,
      sendEmail: () => sendCommentEmail({
        to: recipientEmail,
        actorLabel,
        parentTitle,
        parentKind: parentType === "task" ? "task" : "project",
        breadcrumb: `${companyName} › ${projectName}`,
        excerpt,
        url,
      }),
    });
  }
}
