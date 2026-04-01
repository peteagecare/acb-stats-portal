import { NextRequest } from "next/server";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

function londonDateToUtcMs(dateStr: string, time: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });

  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const parts = formatter.formatToParts(new Date(utcGuess));
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "+00";
  const offsetMatch = tzPart.match(/([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
  return Date.UTC(y, m - 1, d, hh - offsetHours, mm, ss);
}

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

async function hubspotFetch(path: string, token: string, options?: RequestInit) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(`HubSpot API error: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }
}

async function countContactsForRange(
  token: string,
  fromMs: number,
  toMs: number
): Promise<number> {
  const body = {
    filterGroups: [
      {
        filters: [
          { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
          { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
          { propertyName: "conversion_action", operator: "HAS_PROPERTY" },
        ],
      },
    ],
    properties: ["createdate"],
    limit: 1,
  };

  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.total ?? 0;
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return Response.json({ error: "Missing required params: from, to" }, { status: 400 });
  }

  const { buckets, granularity } = buildBuckets(from, to);

  // Batch requests — 4 at a time to avoid HubSpot rate limits
  const BATCH_SIZE = 4;
  const results: { label: string; count: number }[] = [];

  for (let i = 0; i < buckets.length; i += BATCH_SIZE) {
    const batch = buckets.slice(i, i + BATCH_SIZE);
    const counts = await Promise.all(
      batch.map((b) => {
        const bFrom = londonDateToUtcMs(b.from, "00:00:00");
        const bTo = londonDateToUtcMs(b.to, "23:59:59");
        return countContactsForRange(token, bFrom, bTo);
      })
    );
    for (let j = 0; j < batch.length; j++) {
      results.push({ label: batch[j].label, count: counts[j] });
    }
    if (i + BATCH_SIZE < buckets.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return Response.json({ data: results, granularity });
}
