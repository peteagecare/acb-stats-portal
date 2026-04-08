import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

/**
 * Two questions answered in one route:
 *
 *   1. How many home visits happened (or are scheduled) inside the dashboard's
 *      currently-selected date range? (uses `initial_home_visit_date`)
 *
 *   2. Independently of the dashboard date range, how many home visits are
 *      scheduled for: this week, next week, the week after, and the week
 *      after that? (forward-looking calendar — what's on the books).
 *
 * `initial_home_visit_date` is a HubSpot DATE property (no time), stored as
 * midnight UTC of the calendar day. We don't need timezone shifting on the
 * filter values, just on the week-boundary calculations themselves.
 */

async function hubspotSearch(token: string, body: object): Promise<{
  total?: number;
  results?: { properties: Record<string, string | null> }[];
  paging?: { next?: { after: string } };
}> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
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
      throw new Error(`HubSpot search failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }
  throw new Error("HubSpot search failed after retries");
}

/** Midnight UTC of a YYYY-MM-DD string. HubSpot date filters use ms since epoch. */
function dayStartUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0);
}

/** End-of-day UTC ms for a YYYY-MM-DD string (23:59:59.999). */
function dayEndUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

/** Format a JS Date as YYYY-MM-DD in London timezone. */
function londonDateString(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's calendar date in London, returned as a Date pinned to UTC midnight of that day. */
function londonTodayUtcMidnight(): Date {
  const todayStr = londonDateString(new Date());
  const [y, m, d] = todayStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

/** Start of the ISO week (Monday) for the given UTC-midnight date. */
function startOfIsoWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day; // shift back to Mon
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + offset);
  return mon;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(d.getUTCDate() + n);
  return out;
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return Response.json({ error: "Missing required params: from, to" }, { status: 400 });
  }

  try {
    // ──────────────────────────────────────────────────────────────────
    // 1. Three parallel counts for the in-period card:
    //    a) Non-cancelled visits whose initial_home_visit_date is in the period
    //    b) Cancelled visits whose initial_home_visit_date is in the period
    //       (visit was scheduled FOR this period but got cancelled)
    //    c) Visits whose date_that_initial_visit_is_cancelled is in the period
    //       (cancellation event happened DURING this period, regardless of
    //        when the visit itself was scheduled)
    // ──────────────────────────────────────────────────────────────────
    const inPeriodBaseFilters = [
      { propertyName: "initial_home_visit_date", operator: "GTE", value: dayStartUtcMs(from).toString() },
      { propertyName: "initial_home_visit_date", operator: "LTE", value: dayEndUtcMs(to).toString() },
      LIFECYCLE_EXCLUSION_FILTER,
    ];
    const [inPeriodRes, inPeriodCancelledRes, cancelledDuringPeriodRes] = await Promise.all([
      hubspotSearch(token, {
        filterGroups: [
          {
            filters: [
              ...inPeriodBaseFilters,
              { propertyName: "initial_visit_booked_", operator: "NEQ", value: "Cancelled" },
            ],
          },
        ],
        properties: ["initial_home_visit_date"],
        limit: 1,
      }),
      hubspotSearch(token, {
        filterGroups: [
          {
            filters: [
              ...inPeriodBaseFilters,
              { propertyName: "initial_visit_booked_", operator: "EQ", value: "Cancelled" },
            ],
          },
        ],
        properties: ["initial_home_visit_date"],
        limit: 1,
      }),
      hubspotSearch(token, {
        filterGroups: [
          {
            filters: [
              { propertyName: "date_that_initial_visit_is_cancelled", operator: "GTE", value: dayStartUtcMs(from).toString() },
              { propertyName: "date_that_initial_visit_is_cancelled", operator: "LTE", value: dayEndUtcMs(to).toString() },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: ["date_that_initial_visit_is_cancelled"],
        limit: 1,
      }),
    ]);
    const inPeriod = inPeriodRes.total ?? 0;
    const inPeriodCancelled = inPeriodCancelledRes.total ?? 0;
    const cancelledDuringPeriod = cancelledDuringPeriodRes.total ?? 0;

    // ──────────────────────────────────────────────────────────────────
    // 2. Forward calendar — visits scheduled this week / next 3 weeks
    // ──────────────────────────────────────────────────────────────────
    const today = londonTodayUtcMidnight();
    const week0Start = startOfIsoWeek(today);
    const buckets = [
      { label: "This Week", start: week0Start, end: addDays(week0Start, 6) },
      { label: "Next Week", start: addDays(week0Start, 7), end: addDays(week0Start, 13) },
      { label: "Week After", start: addDays(week0Start, 14), end: addDays(week0Start, 20) },
      { label: "Week After That", start: addDays(week0Start, 21), end: addDays(week0Start, 27) },
    ];
    const calendarFrom = buckets[0].start;
    const calendarTo = buckets[buckets.length - 1].end;

    // Two paginated searches across the 4-week window:
    //   - by initial_home_visit_date  → counts (booked) + cancelled
    //   - by date_that_initial_visit_is_cancelled → cancelledDuringWeek
    // Each one bucketed into the four week ranges client-side.
    const counts = [0, 0, 0, 0];
    const cancelled = [0, 0, 0, 0];
    const cancelledDuringWeek = [0, 0, 0, 0];
    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 20;

    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "initial_home_visit_date",
                operator: "GTE",
                value: calendarFrom.getTime().toString(),
              },
              {
                propertyName: "initial_home_visit_date",
                operator: "LTE",
                // HubSpot date type: end of day for the last bucket day
                value: (calendarTo.getTime() + 86_399_999).toString(),
              },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: ["initial_home_visit_date", "initial_visit_booked_"],
        limit: 100,
        sorts: [{ propertyName: "initial_home_visit_date", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const data = await hubspotSearch(token, body);
      for (const c of data.results ?? []) {
        const raw = c.properties?.initial_home_visit_date;
        if (!raw) continue;
        // HubSpot returns date-type properties as YYYY-MM-DD strings, not ms
        const [y, mo, d] = raw.split("-").map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) continue;
        const ms = Date.UTC(y, mo - 1, d);
        const isCancelled = c.properties?.initial_visit_booked_ === "Cancelled";
        for (let i = 0; i < buckets.length; i++) {
          const bStart = buckets[i].start.getTime();
          const bEnd = buckets[i].end.getTime() + 86_399_999;
          if (ms >= bStart && ms <= bEnd) {
            if (isCancelled) {
              cancelled[i] += 1;
            } else {
              counts[i] += 1;
            }
            break;
          }
        }
      }

      after = data.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    // Second paginated search: cancellation events whose
    // date_that_initial_visit_is_cancelled falls in the 4-week window.
    let cancelAfter: string | undefined;
    let cancelPages = 0;
    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "date_that_initial_visit_is_cancelled",
                operator: "GTE",
                value: calendarFrom.getTime().toString(),
              },
              {
                propertyName: "date_that_initial_visit_is_cancelled",
                operator: "LTE",
                value: (calendarTo.getTime() + 86_399_999).toString(),
              },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: ["date_that_initial_visit_is_cancelled"],
        limit: 100,
        sorts: [{ propertyName: "date_that_initial_visit_is_cancelled", direction: "ASCENDING" }],
      };
      if (cancelAfter) body.after = cancelAfter;

      const data = await hubspotSearch(token, body);
      for (const c of data.results ?? []) {
        const raw = c.properties?.date_that_initial_visit_is_cancelled;
        if (!raw) continue;
        const [y, mo, d] = raw.split("-").map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) continue;
        const ms = Date.UTC(y, mo - 1, d);
        for (let i = 0; i < buckets.length; i++) {
          const bStart = buckets[i].start.getTime();
          const bEnd = buckets[i].end.getTime() + 86_399_999;
          if (ms >= bStart && ms <= bEnd) {
            cancelledDuringWeek[i] += 1;
            break;
          }
        }
      }

      cancelAfter = data.paging?.next?.after;
      cancelPages++;
      if (cancelPages >= MAX_PAGES) break;
    } while (cancelAfter);

    return Response.json({
      inPeriod,
      inPeriodCancelled,
      cancelledDuringPeriod,
      upcoming: buckets.map((b, i) => ({
        label: b.label,
        weekStart: londonDateString(b.start),
        weekEnd: londonDateString(b.end),
        count: counts[i],
        cancelled: cancelled[i],
        cancelledDuringWeek: cancelledDuringWeek[i],
      })),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HubSpot request failed" },
      { status: 502 },
    );
  }
}
