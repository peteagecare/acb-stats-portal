import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, notificationPrefs, notifications, projects } from "@/db/schema";
import { loadUsers } from "@/lib/users";
import { sendTaskAssignedEmail } from "@/lib/email";

/** Fire an in-app notification + email when a workspace task is assigned to
 *  someone other than the actor. No-op if recipient is null/empty or matches
 *  the actor. Honors the recipient's notification_prefs. */
export async function notifyWorkspaceTaskAssigned(opts: {
  taskId: string;
  taskTitle: string;
  projectId: string;
  recipientEmail: string;
  actorEmail: string;
  origin: string;
}): Promise<void> {
  const { taskId, taskTitle, projectId, recipientEmail, actorEmail, origin } = opts;
  if (!recipientEmail || recipientEmail === actorEmail) return;

  // Look up project + company (for the email breadcrumb and the bell link)
  const [proj] = await db
    .select({
      id: projects.id,
      name: projects.name,
      companyId: projects.companyId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!proj) return;

  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, proj.companyId))
    .limit(1);

  const [pref] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userEmail, recipientEmail))
    .limit(1);
  const wantInApp = pref?.workspaceTaskAssignInApp ?? true;
  const wantEmail = pref?.workspaceTaskAssignEmail ?? true;

  const users = await loadUsers();
  const actorLabel = users.find((u) => u.email === actorEmail)?.label ?? actorEmail;

  if (wantInApp) {
    await db.insert(notifications).values({
      recipientEmail,
      kind: "workspace_task_assigned",
      noteId: null,
      taskId,
      actorEmail,
      payload: {
        taskTitle,
        actorLabel,
        projectId: proj.id,
        projectName: proj.name,
        companyId: proj.companyId,
        companyName: company?.name ?? "",
      },
    });
  }

  if (wantEmail) {
    sendTaskAssignedEmail({
      to: recipientEmail,
      actorLabel,
      taskTitle,
      projectName: proj.name,
      companyName: company?.name ?? "",
      taskUrl: `${origin}/workspace/${proj.companyId}/${proj.id}?task=${taskId}`,
    }).catch(() => {});
  }
}
