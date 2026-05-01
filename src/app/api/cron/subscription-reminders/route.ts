import { NextRequest } from "next/server";
import { loadJson } from "@/lib/blob-store";
import { isAuthorisedCron } from "@/lib/cron-auth";
import { sendSubscriptionReminderEmail } from "@/lib/email";
import { notify } from "@/lib/notify";

interface Subscription {
  id: string;
  name: string;
  cost: number;
  currency: "GBP" | "USD" | "EUR";
  frequency: "monthly" | "annual";
  category: string;
  notes: string;
  startDate?: string;
  endDate?: string;
  paymentDay?: number;
}

interface SubscriptionsData {
  items: Subscription[];
  usdToGbp: number;
  eurToGbp: number;
}

const PETE_EMAIL = "pete@agecare-bathrooms.co.uk";
const WINDOW_DAYS = 7;

/** For an annual subscription, return the next renewal date >= today. */
function nextAnnualRenewal(startDate: string): Date | null {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return next;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function gbp(sub: Subscription, rates: { usdToGbp: number; eurToGbp: number }): number {
  if (sub.currency === "USD") return sub.cost * rates.usdToGbp;
  if (sub.currency === "EUR") return sub.cost * rates.eurToGbp;
  return sub.cost;
}

export async function GET(request: NextRequest) {
  if (!isAuthorisedCron(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await loadJson<SubscriptionsData>(
    "subscriptions.json",
    "./subscriptions.json",
    { items: [], usdToGbp: 0.79, eurToGbp: 0.86 } as SubscriptionsData,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming: { sub: Subscription; renewal: Date; daysUntil: number; gbpCost: number }[] = [];

  for (const sub of data.items) {
    if (sub.endDate) continue; // cancelled
    if (sub.frequency !== "annual") continue;
    if (!sub.startDate) continue;
    const renewal = nextAnnualRenewal(sub.startDate);
    if (!renewal) continue;
    const daysUntil = daysBetween(today, renewal);
    if (daysUntil < 0 || daysUntil > WINDOW_DAYS) continue;
    upcoming.push({
      sub,
      renewal,
      daysUntil,
      gbpCost: gbp(sub, { usdToGbp: data.usdToGbp, eurToGbp: data.eurToGbp }),
    });
  }

  if (upcoming.length === 0) {
    return Response.json({ ok: true, sent: 0, upcoming: [] });
  }

  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  const origin = request.nextUrl.origin;
  await notify({
    recipientEmail: PETE_EMAIL,
    actorEmail: "system@portal",
    kind: "subscription_reminder",
    payload: {
      itemTitle: `${upcoming.length} subscription${upcoming.length === 1 ? "" : "s"} renewing soon`,
      itemUrl: "/subscriptions",
      summary: upcoming.map((u) => `${u.sub.name} in ${u.daysUntil}d`).join(" · "),
    },
    inAppKey: "subscriptionInApp",
    emailKey: "subscriptionEmail",
    sendEmail: () => sendSubscriptionReminderEmail({
      to: PETE_EMAIL,
      upcoming: upcoming.map((u) => ({
        name: u.sub.name,
        renewalDate: u.renewal.toISOString().slice(0, 10),
        daysUntil: u.daysUntil,
        gbpCost: u.gbpCost,
        category: u.sub.category,
      })),
      url: `${origin}/subscriptions`,
    }),
  });

  return Response.json({
    ok: true,
    sent: 1,
    upcoming: upcoming.map((u) => ({ name: u.sub.name, daysUntil: u.daysUntil, gbp: u.gbpCost })),
  });
}
