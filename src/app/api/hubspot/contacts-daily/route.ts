import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotFetch, PROSPECT_ACTIONS, LEAD_ACTIONS } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Bucket {
  label: string;
  from: string;
  to: string;
}

/**
 * Auto-bucket a date range:
 *   ≤ 45 days  → daily
 *   ≤ 180 days → weekly (Mon–Sun)
 *   > 180 days → monthly
 */
function buildBuckets(from: string, to: string): { buckets: Bucket[]; granularity: string } {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (totalDays <= 45) {
    // Daily
    const buckets: Bucket[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const ds = toDateStr(cur);
      buckets.push({ label: ds, from: ds, to: ds });
      cur.setDate(cur.getDate() + 1);
    }
    return { buckets, granularity: "day" };
  }

  if (totalDays <= 180) {
    // Weekly
    const buckets: Bucket[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const weekStart = toDateStr(cur);
      // advance to Sunday or end, whichever is first
      const weekEnd = new Date(cur);
      weekEnd.setDate(weekEnd.getDate() + (6 - ((weekEnd.getDay() + 6) % 7))); // next Sunday
      if (weekEnd > end) weekEnd.setTime(end.getTime());
      const weekEndStr = toDateStr(weekEnd);
      // label = "3 Mar" format
      const label = `${cur.getDate()} ${cur.toLocaleString("en-GB", { month: "short" })}`;
      buckets.push({ label, from: weekStart, to: weekEndStr });
      cur.setTime(weekEnd.getTime());
      cur.setDate(cur.getDate() + 1);
    }
    return { buckets, granularity: "week" };
  }

  // Monthly
  const buckets: Bucket[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const monthStart = new Date(Math.max(cur.getTime(), start.getTime()));
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0); // last day of month
    const actualEnd = monthEnd > end ? end : monthEnd;
    const label = cur.toLocaleString("en-GB", { month: "short", year: "2-digit" });
    buckets.push({ label, from: toDateStr(monthStart), to: toDateStr(actualEnd) });
    cur.setMonth(cur.getMonth() + 1);
  }
  return { buckets, granularity: "month" };
}

function buildFilters(metric: string, fromMs: number, toMs: number): { filterGroups: Record<string, unknown>[]; properties: string[]; dateProperty?: string } {
  const dateRange = [
    { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
    { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
  ];

  switch (metric) {
    case "prospects":
      return {
        filterGroups: [{ filters: [...dateRange, { propertyName: "conversion_action", operator: "IN", values: PROSPECT_ACTIONS }, LIFECYCLE_EXCLUSION_FILTER] }],
        properties: ["createdate"],
      };
    case "leads":
      return {
        filterGroups: [{ filters: [...dateRange, { propertyName: "conversion_action", operator: "IN", values: LEAD_ACTIONS }, LIFECYCLE_EXCLUSION_FILTER] }],
        properties: ["createdate"],
      };
    case "visits":
      return {
        filterGroups: [{
          filters: [
            { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "GTE", value: fromMs.toString() },
            { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "LTE", value: toMs.toString() },
            LIFECYCLE_EXCLUSION_FILTER,
          ],
        }],
        properties: ["date_that_initial_visit_booked_is_set_to_yes"],
      };
    default: // contacts
      return {
        filterGroups: [{ filters: [...dateRange, { propertyName: "conversion_action", operator: "HAS_PROPERTY" }, LIFECYCLE_EXCLUSION_FILTER] }],
        properties: ["createdate"],
      };
  }
}

async function countForRange(
  token: string,
  metric: string,
  fromMs: number,
  toMs: number
): Promise<number> {
  const { filterGroups, properties } = buildFilters(metric, fromMs, toMs);

  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: JSON.stringify({ filterGroups, properties, limit: 1 }),
  });

  return (data.total as number) ?? 0;
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const metric = searchParams.get("metric") ?? "contacts";

  if (!from || !to) {
    return Response.json({ error: "Missing required params: from, to" }, { status: 400 });
  }

  const key = cacheKey("contacts-daily", { from, to, metric });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const { buckets, granularity } = buildBuckets(from, to);

    // Fire all bucket counts in parallel — no delays needed
    const counts = await Promise.all(
      buckets.map((b) => {
        const bFrom = londonDateToUtcMs(b.from, "00:00:00");
        const bTo = londonDateToUtcMs(b.to, "23:59:59");
        return countForRange(token, metric, bFrom, bTo);
      })
    );
    const results = buckets.map((b, i) => ({ label: b.label, count: counts[i] }));

    return { data: results, granularity, metric };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
