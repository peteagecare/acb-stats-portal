import { NextRequest } from "next/server";
import { HUBSPOT_API } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

const TZ = "Europe/London";

/**
 * Counts of scheduled installs for the current month, next month, and the
 * month after that. Independent of the dashboard date range — this is a
 * forward-looking ops calendar like the upcoming site visits cards.
 *
 * Source: HubSpot DEALS, `installation_date` (date type, no time component).
 * Lost deals (`closedlost` stage) are excluded; everything else with an
 * installation_date set in the month is counted.
 */

async function dealsSearch(
  token: string,
  body: object,
): Promise<{ total?: number }> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/deals/search`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(`HubSpot deals/search failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }
  throw new Error("HubSpot deals/search failed after retries");
}

/** Today's calendar date in London, returned as YYYY-MM-DD. */
function londonToday(): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { y: parseInt(get("year"), 10), m: parseInt(get("month"), 10), d: parseInt(get("day"), 10) };
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(_request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const key = cacheKey("installs", {});
  const data = await cached(key, TTL.SHORT, async () => {
    const today = londonToday();

    // Build the three month windows: this month, next month, month after
    function monthWindow(offset: number): { startMs: number; endMs: number; label: string; year: number; month: number } {
      let m = today.m - 1 + offset; // 0-indexed
      let y = today.y;
      while (m < 0) { m += 12; y -= 1; }
      while (m > 11) { m -= 12; y += 1; }
      const startMs = Date.UTC(y, m, 1, 0, 0, 0);
      const endMs = Date.UTC(y, m + 1, 0, 23, 59, 59, 999); // last day of month
      return { startMs, endMs, label: MONTH_LABELS[m], year: y, month: m + 1 };
    }

    const months = [
      { ...monthWindow(0), key: "thisMonth" as const, displayLabel: "This Month" },
      { ...monthWindow(1), key: "nextMonth" as const, displayLabel: "Next Month" },
      { ...monthWindow(2), key: "monthAfter" as const, displayLabel: "Month After" },
    ];

    const counts = await Promise.all(
      months.map((m) =>
        dealsSearch(token, {
          filterGroups: [
            {
              filters: [
                { propertyName: "installation_date", operator: "GTE", value: m.startMs.toString() },
                { propertyName: "installation_date", operator: "LTE", value: m.endMs.toString() },
                { propertyName: "dealstage", operator: "NEQ", value: "closedlost" },
              ],
            },
          ],
          properties: ["installation_date"],
          limit: 1,
        }),
      ),
    );

    return {
      months: months.map((m, i) => ({
        key: m.key,
        label: m.displayLabel,
        monthName: m.label,
        year: m.year,
        count: counts[i].total ?? 0,
      })),
    };
  });

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
}
