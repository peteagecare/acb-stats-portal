import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

/**
 * For each day of the week, count:
 *   - how many contacts were CREATED on that day-of-week within the period
 *   - how many of those contacts ALSO ended up booking a home visit
 *
 * Answers: "Are weekend contacts worth anything? Do they convert?"
 *
 * The contact count uses the same definition as the rest of the dashboard
 * (conversion_action HAS_PROPERTY + lifecycle exclusion). Visit conversion
 * is judged by whether `date_that_initial_visit_booked_is_set_to_yes` has
 * any value — we don't care WHEN the visit was booked, only that it
 * eventually happened. That matters because weekend contacts often only
 * get picked up and booked in on Monday/Tuesday.
 */

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

async function hubspotSearch(token: string, body: object): Promise<{
  results: { properties: Record<string, string | null> }[];
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

/**
 * Convert a UTC ISO timestamp string into a London-zone day-of-week index
 * (0 = Monday … 6 = Sunday). Important: a contact created at 11pm GMT on
 * a Sunday should be Sunday in our chart, not Monday in UTC.
 */
function londonDayOfWeek(isoUtc: string): number {
  const date = new Date(isoUtc);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
  });
  const wd = formatter.format(date);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
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

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  const contacts = [0, 0, 0, 0, 0, 0, 0];
  const withVisit = [0, 0, 0, 0, 0, 0, 0];

  let after: string | undefined;
  let pages = 0;
  const MAX_PAGES = 50; // 50 * 100 = 5000 contacts ceiling — more than enough

  try {
    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
              { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
              { propertyName: "conversion_action", operator: "HAS_PROPERTY" },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: ["createdate", "date_that_initial_visit_booked_is_set_to_yes"],
        limit: 100,
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const data = await hubspotSearch(token, body);

      for (const contact of data.results ?? []) {
        const createdate = contact.properties?.createdate;
        if (!createdate) continue;
        const dow = londonDayOfWeek(createdate);
        contacts[dow] += 1;
        if (contact.properties?.date_that_initial_visit_booked_is_set_to_yes) {
          withVisit[dow] += 1;
        }
      }

      after = data.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    return Response.json({ contacts, withVisit, truncated: pages >= MAX_PAGES });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HubSpot request failed" },
      { status: 502 }
    );
  }
}
