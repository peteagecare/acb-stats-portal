import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, fetchPropertyLabels, PROSPECT_ACTIONS_SET, LEAD_ACTIONS_SET } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Returns the full customer funnel sliced by `original_lead_source`, using
 * a COHORT view: "of contacts created in this period from source X, how
 * many became prospects / leads / visits / won?"
 *
 * One paginated HubSpot search through all qualifying contacts in the
 * period; everything else is bucketed client-side, so this is a single
 * query regardless of how many sources exist.
 *
 * Note: this is intentionally a different lens from the main dashboard
 * KPIs, which use independent date filters per metric (e.g. visits
 * booked in period regardless of when the contact was created). The
 * cohort view answers "how is this source performing"; the main view
 * answers "what's happening in this period".
 */

interface SourceFunnel {
  contacts: number;
  prospects: number;
  formLeads: number;
  directBookings: number;
  homeVisits: number;
  wonJobs: number;
  prospectActions: Record<string, number>;
  leadActions: Record<string, number>;
}

function emptyFunnel(): SourceFunnel {
  return {
    contacts: 0,
    prospects: 0,
    formLeads: 0,
    directBookings: 0,
    homeVisits: 0,
    wonJobs: 0,
    prospectActions: {},
    leadActions: {},
  };
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

  const key = cacheKey("funnel-by-source", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const bySource = new Map<string, SourceFunnel>();
    function getOrCreate(key: string): SourceFunnel {
      let f = bySource.get(key);
      if (!f) {
        f = emptyFunnel();
        bySource.set(key, f);
      }
      return f;
    }

    const labelsPromise = fetchPropertyLabels(token, "original_lead_source");

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 80; // 8000 contact ceiling per range — generous

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
          "original_lead_source",
          "conversion_action",
          "date_that_initial_visit_booked_is_set_to_yes",
          "won_date",
        ],
        limit: 100,
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const result = await hubspotSearch(token, body);
      for (const c of result.results ?? []) {
        const source = c.properties?.original_lead_source ?? "__none__";
        const action = c.properties?.conversion_action ?? "";
        const visitBooked = !!c.properties?.date_that_initial_visit_booked_is_set_to_yes;
        const won = !!c.properties?.won_date;

        const f = getOrCreate(source);
        f.contacts += 1;

        if (PROSPECT_ACTIONS_SET.has(action)) {
          f.prospects += 1;
          f.prospectActions[action] = (f.prospectActions[action] ?? 0) + 1;
        } else if (LEAD_ACTIONS_SET.has(action)) {
          f.formLeads += 1;
          f.leadActions[action] = (f.leadActions[action] ?? 0) + 1;
        }

        if (visitBooked) {
          f.homeVisits += 1;
          if (!LEAD_ACTIONS_SET.has(action)) {
            f.directBookings += 1;
          }
        }

        if (won) {
          f.wonJobs += 1;
        }
      }

      after = result.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    const labels = await labelsPromise;

    const sources = Array.from(bySource.entries())
      .map(([value, f]) => ({
        value,
        label: value === "__none__" ? "(No source)" : (labels[value] ?? value),
        ...f,
        prospectActions: Object.entries(f.prospectActions)
          .map(([k, v]) => ({ value: k, count: v }))
          .sort((a, b) => b.count - a.count),
        leadActions: Object.entries(f.leadActions)
          .map(([k, v]) => ({ value: k, count: v }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.contacts - a.contacts);

    return { sources };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
