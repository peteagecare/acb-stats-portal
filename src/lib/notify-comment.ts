import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { comments, tasks, projects, companies } from "@/db/schema";
import { loadUsers } from "@/lib/users";
import { sendCommentEmail } from "@/lib/email";
import { notify } from "@/lib/notify";

/** Notify the parent owner + all earlier commenters when a new comment lands.
 *  Skips the actor. Honors `commentInApp` / `commentEmail` prefs. */
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

  const recipients = new Set<string>();
  if (ownerEmail) recipients.add(ownerEmail);
  for (const r of earlier) {
    if (r.authorEmail) recipients.add(r.authorEmail);
  }
  recipients.delete(actorEmail);

  if (recipients.size === 0) return;

  const users = await loadUsers();
  const actorLabel = users.find((u) => u.email === actorEmail)?.label ?? actorEmail;
  const excerpt = commentBody.length > 280 ? `${commentBody.slice(0, 277)}…` : commentBody;
  const url = parentType === "task"
    ? `${origin}/workspace/${companyId}/${projectId}?task=${taskId}`
    : `${origin}/workspace/${companyId}/${projectId}`;

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
        parentUrl: url.replace(origin, ""),
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
