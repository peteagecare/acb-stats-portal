import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, fetchPropertyLabels } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

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
 *
 * Returns the same totals broken down by `original_lead_source` and
 * `conversion_action` so the dashboard can answer follow-up questions
 * like "which source actually converts on a weekend".
 */

const TZ = "Europe/London";

interface DowSegment {
  contacts: number[];
  withVisit: number[];
}

function emptySegment(): DowSegment {
  return { contacts: [0, 0, 0, 0, 0, 0, 0], withVisit: [0, 0, 0, 0, 0, 0, 0] };
}

/**
 * Convert a UTC ISO timestamp string into a London-zone day-of-week index
 * (0 = Monday ... 6 = Sunday). Important: a contact created at 11pm GMT on
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

  const key = cacheKey("dow-conversion", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const overall = emptySegment();
    const bySource = new Map<string, DowSegment>();
    const byAction = new Map<string, DowSegment>();

    function bump(map: Map<string, DowSegment>, key: string, dow: number, hadVisit: boolean) {
      let seg = map.get(key);
      if (!seg) {
        seg = emptySegment();
        map.set(key, seg);
      }
      seg.contacts[dow] += 1;
      if (hadVisit) seg.withVisit[dow] += 1;
    }

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 50; // 50 * 100 = 5000 contacts ceiling — more than enough

    // Fetch property labels in parallel with the first contacts page
    const labelsPromise = Promise.all([
      fetchPropertyLabels(token, "original_lead_source"),
      fetchPropertyLabels(token, "conversion_action"),
    ]);

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
        properties: [
          "createdate",
          "date_that_initial_visit_booked_is_set_to_yes",
          "original_lead_source",
          "conversion_action",
        ],
        limit: 100,
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const result = await hubspotSearch(token, body);

      for (const contact of result.results ?? []) {
        const createdate = contact.properties?.createdate;
        if (!createdate) continue;
        const dow = londonDayOfWeek(createdate);
        const hadVisit = !!contact.properties?.date_that_initial_visit_booked_is_set_to_yes;

        overall.contacts[dow] += 1;
        if (hadVisit) overall.withVisit[dow] += 1;

        const source = contact.properties?.original_lead_source ?? "(No source)";
        bump(bySource, source, dow, hadVisit);

        const action = contact.properties?.conversion_action ?? "(No action)";
        bump(byAction, action, dow, hadVisit);
      }

      after = result.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    const [sourceLabels, actionLabels] = await labelsPromise;

    function serialise(map: Map<string, DowSegment>, labels: Record<string, string>) {
      return Array.from(map.entries())
        .map(([value, seg]) => ({
          value,
          label: labels[value] ?? value,
          contacts: seg.contacts,
          withVisit: seg.withVisit,
          totalContacts: seg.contacts.reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.totalContacts - a.totalContacts);
    }

    return {
      contacts: overall.contacts,
      withVisit: overall.withVisit,
      bySource: serialise(bySource, sourceLabels),
      byAction: serialise(byAction, actionLabels),
      truncated: pages >= MAX_PAGES,
    };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
