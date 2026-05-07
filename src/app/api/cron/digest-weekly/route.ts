import { NextRequest } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks, projects, companies } from "@/db/schema";
import { loadJson } from "@/lib/blob-store";
import { loadUsers } from "@/lib/users";
import { isAuthorisedCron } from "@/lib/cron-auth";
import { sendWeeklyDigestEmail } from "@/lib/email";
import { notify } from "@/lib/notify";

interface CalendarEntry { id: string; title: string; liveDate: string; time?: string; platform?: string; platforms?: string[]; status: string; }
function platformLabel(c: CalendarEntry): string {
  if (Array.isArray(c.platforms) && c.platforms.length) return c.platforms.join(", ");
  return c.platform ?? "";
}

const PROSPECT_ACTIONS = ["Brochure Download Form", "Flipbook Form", "VAT Exempt Checker", "Pricing Guide", "Physical Brochure Request", "Newsletter Sign Up"];
const LEAD_ACTIONS = ["Brochure - Call Me", "Request A Callback Form", "Contact Form", "Free Home Design Form", "Phone Call", "Walk In Bath Form", "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit"];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function isoDay(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export async function GET(request: NextRequest) {
  if (!isAuthorisedCron(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin = request.nextUrl.origin;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = isoDay(today);

  // Last week: previous Mon-Sun
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  const lastWeekFrom = isoDay(lastMonday);
  const lastWeekTo = isoDay(lastSunday);

  // This week: today through Sunday
  const thisWeekEnd = new Date(today);
  thisWeekEnd.setDate(today.getDate() + (6 - ((today.getDay() + 6) % 7)));

  // Last week's funnel (HubSpot, single fetch shared across all users)
  let funnel = { contacts: 0, prospects: 0, leads: 0, siteVisits: 0, won: 0, wonValue: 0 };
  const cronAuth = { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` };
  try {
    const [c, ca, sv, wd] = await Promise.all([
      fetch(`${origin}/api/hubspot/contacts-created?from=${lastWeekFrom}&to=${lastWeekTo}`, { headers: cronAuth }).then((r) => r.ok ? r.json() : null),
      fetch(`${origin}/api/hubspot/conversion-actions?from=${lastWeekFrom}&to=${lastWeekTo}`, { headers: cronAuth }).then((r) => r.ok ? r.json() : null),
      fetch(`${origin}/api/hubspot/site-visits?from=${lastWeekFrom}&to=${lastWeekTo}`, { headers: cronAuth }).then((r) => r.ok ? r.json() : null),
      fetch(`${origin}/api/hubspot/won-deals?from=${lastWeekFrom}&to=${lastWeekTo}`, { headers: cronAuth }).then((r) => r.ok ? r.json() : null),
    ]);
    const actions = (ca?.actions ?? []) as { value: string; count: number }[];
    funnel = {
      contacts: c?.total ?? 0,
      prospects: actions.filter((a) => PROSPECT_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0),
      leads: actions.filter((a) => LEAD_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0),
      siteVisits: sv?.inPeriod ?? 0,
      won: wd?.total ?? 0,
      wonValue: wd?.totalValue ?? 0,
    };
  } catch { /* HubSpot tolerated */ }

  // This week's calendar
  const calendar = await loadJson<CalendarEntry[]>("content-calendar.json", "./content-calendar.json", []);
  const thisWeekContent = calendar
    .filter((c) => c.liveDate >= todayStr && c.liveDate <= isoDay(thisWeekEnd) && c.status !== "Cancelled")
    .sort((a, b) => a.liveDate.localeCompare(b.liveDate))
    .map((c) => ({ title: c.title, platform: platformLabel(c), status: c.status, liveDate: c.liveDate }));

  const users = await loadUsers();
  const sent: string[] = [];

  for (const user of users) {
    // Per-user overdue tasks
    const overdue = await db
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
        eq(tasks.ownerEmail, user.email),
        eq(tasks.completed, false),
        lt(tasks.endDate, todayStr),
      ));

    await notify({
      recipientEmail: user.email,
      actorEmail: "system@portal",
      kind: "digest_weekly",
      payload: {
        itemTitle: "Weekly digest",
        itemUrl: "/",
        summary: `Last week: ${funnel.leads} leads · ${funnel.won} won · ${overdue.length} overdue`,
      },
      inAppKey: "digestWeeklyInApp",
      emailKey: "digestWeeklyEmail",
      defaultInApp: false,
      sendEmail: () => sendWeeklyDigestEmail({
        to: user.email,
        recipientLabel: user.label,
        weekLabel: `${lastMonday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${lastSunday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        origin,
        funnel,
        thisWeekContent,
        overdue: overdue.map((t) => ({
          title: t.title,
          url: `${origin}/workspace/${t.companyId}/${t.projectId}?task=${t.id}`,
          project: `${t.companyName} › ${t.projectName}`,
          endDate: t.endDate ?? "",
        })),
      }),
    });

    sent.push(user.email);
  }

  return Response.json({ ok: true, sent: sent.length });
}
