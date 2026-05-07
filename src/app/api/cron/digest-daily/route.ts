import { NextRequest } from "next/server";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks, projects, companies } from "@/db/schema";
import { loadJson } from "@/lib/blob-store";
import { loadUsers, AppUser } from "@/lib/users";
import { isAuthorisedCron } from "@/lib/cron-auth";
import { sendDailyDigestEmail } from "@/lib/email";
import { notify } from "@/lib/notify";

interface CalendarEntry { id: string; title: string; liveDate: string; time?: string; platform?: string; platforms?: string[]; status: string; assetLink?: string; }
function platformLabel(c: CalendarEntry): string {
  if (Array.isArray(c.platforms) && c.platforms.length) return c.platforms.join(", ");
  return c.platform ?? "";
}
interface ChartNote { id: string; date: string; text: string; author: string; createdAt?: string; }

function pad(n: number) { return n.toString().padStart(2, "0"); }
function isoDay(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

async function dueAndOverdueForUser(userEmail: string, todayStr: string) {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      endDate: tasks.endDate,
      projectId: tasks.projectId,
      projectName: projects.name,
      companyId: projects.companyId,
      companyName: companies.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(and(
      eq(tasks.ownerEmail, userEmail),
      eq(tasks.completed, false),
      or(eq(tasks.endDate, todayStr), lte(tasks.endDate, todayStr)),
    ));
  const due = rows.filter((r) => r.endDate === todayStr);
  const overdue = rows.filter((r) => r.endDate && r.endDate < todayStr);
  return { due, overdue };
}

export async function GET(request: NextRequest) {
  if (!isAuthorisedCron(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin = request.nextUrl.origin;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = isoDay(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = isoDay(yesterday);

  // Week range — Monday through Sunday (today included)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Shared data: site visits this week (HubSpot, fetched once)
  let siteVisitsThisWeek: number = 0;
  try {
    const res = await fetch(`${origin}/api/hubspot/site-visits?from=${isoDay(weekStart)}&to=${isoDay(weekEnd)}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      cache: "no-store",
    });
    if (res.ok) {
      const j = await res.json();
      siteVisitsThisWeek = j.inPeriod ?? 0;
    }
  } catch { /* tolerate HubSpot failure */ }

  // Calendar items going live today (everyone gets the same list)
  const calendar = await loadJson<CalendarEntry[]>("content-calendar.json", "./content-calendar.json", []);
  const goLiveToday = calendar
    .filter((c) => c.liveDate === todayStr && c.status !== "Cancelled")
    .map((c) => ({
      id: c.id,
      title: c.title,
      platform: platformLabel(c),
      status: c.status,
      time: c.time ?? "",
      missingAsset: !c.assetLink,
    }));

  // Team changes logged yesterday
  const chartNotes = await loadJson<ChartNote[]>("chart-notes.json", "./chart-notes.json", []);
  const teamChangesYesterday = chartNotes.filter((n) => n.date === yesterdayStr);

  const users = await loadUsers();
  const sent: { user: string; sections: { tasksDue: number; tasksOverdue: number } }[] = [];

  for (const user of users) {
    const { due, overdue } = await dueAndOverdueForUser(user.email, todayStr);

    const hasContent =
      due.length > 0 ||
      overdue.length > 0 ||
      goLiveToday.length > 0 ||
      siteVisitsThisWeek > 0 ||
      teamChangesYesterday.length > 0;
    if (!hasContent) continue;

    await notify({
      recipientEmail: user.email,
      actorEmail: "system@portal",
      kind: "digest_daily",
      payload: {
        itemTitle: "Daily digest",
        itemUrl: "/",
        summary: `${due.length} due · ${overdue.length} overdue · ${goLiveToday.length} live today`,
      },
      inAppKey: "digestDailyInApp",
      emailKey: "digestDailyEmail",
      defaultInApp: false,
      sendEmail: () => sendDailyDigestEmail({
        to: user.email,
        recipientLabel: user.label,
        date: today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
        origin,
        sections: {
          tasksDue: due.map((t) => ({
            title: t.title,
            url: `${origin}/workspace/${t.companyId}/${t.projectId}?task=${t.id}`,
            project: `${t.companyName} › ${t.projectName}`,
          })),
          tasksOverdue: overdue.map((t) => ({
            title: t.title,
            url: `${origin}/workspace/${t.companyId}/${t.projectId}?task=${t.id}`,
            project: `${t.companyName} › ${t.projectName}`,
            endDate: t.endDate ?? "",
          })),
          goLiveToday,
          siteVisitsThisWeek,
          teamChangesYesterday: teamChangesYesterday.map((n) => ({
            text: n.text,
            author: n.author,
          })),
        },
      }),
    });

    sent.push({ user: user.email, sections: { tasksDue: due.length, tasksOverdue: overdue.length } });
  }

  return Response.json({ ok: true, sent: sent.length, users: sent });
}
