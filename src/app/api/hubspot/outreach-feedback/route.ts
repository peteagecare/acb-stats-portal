import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, fetchPropertyLabels } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Initial Outreach Feedback breakdowns.
 *
 * For each contact whose `hs_first_outreach_date` falls in [from, to] AND
 * who has an `initial_outreach_feedback` value set, tally the feedback
 * value broken down by `original_lead_source` and `conversion_action`.
 *
 * The sales team uses initial_outreach_feedback to mark how the very
 * first outreach call went (Time Wasters / Not Answering / Grant / etc.),
 * so this view answers: "are certain lead sources or conversion actions
 * disproportionately producing bad-quality outreach calls?"
 *
 * One paginated HubSpot search; everything bucketed client-side.
 */

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

  const key = cacheKey("outreach-feedback", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    // feedbackTotals[feedback] = count
    // bySourcePerFeedback[feedback][source] = count
    // byActionPerFeedback[feedback][action] = count
    const feedbackTotals = new Map<string, number>();
    const bySource = new Map<string, Map<string, number>>();
    const byAction = new Map<string, Map<string, number>>();

    function bumpNested(map: Map<string, Map<string, number>>, outer: string, inner: string) {
      let m = map.get(outer);
      if (!m) {
        m = new Map();
        map.set(outer, m);
      }
      m.set(inner, (m.get(inner) ?? 0) + 1);
    }

    const labelsPromise = Promise.all([
      fetchPropertyLabels(token, "initial_outreach_feedback"),
      fetchPropertyLabels(token, "original_lead_source"),
      fetchPropertyLabels(token, "conversion_action"),
    ]);

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 80;
    let total = 0;

    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              { propertyName: "hs_first_outreach_date", operator: "GTE", value: fromMs.toString() },
              { propertyName: "hs_first_outreach_date", operator: "LTE", value: toMs.toString() },
              { propertyName: "initial_outreach_feedback", operator: "HAS_PROPERTY" },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: [
          "initial_outreach_feedback",
          "original_lead_source",
          "conversion_action",
          "hs_first_outreach_date",
        ],
        limit: 100,
        sorts: [{ propertyName: "hs_first_outreach_date", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const result = await hubspotSearch(token, body);
      for (const c of result.results ?? []) {
        const feedback = c.properties?.initial_outreach_feedback;
        if (!feedback) continue;
        const source = c.properties?.original_lead_source ?? "__none__";
        const action = c.properties?.conversion_action ?? "__none__";

        total += 1;
        feedbackTotals.set(feedback, (feedbackTotals.get(feedback) ?? 0) + 1);
        bumpNested(bySource, feedback, source);
        bumpNested(byAction, feedback, action);
      }

      after = result.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    const [feedbackLabels, sourceLabels, actionLabels] = await labelsPromise;

    function serialiseInner(m: Map<string, number>, labels: Record<string, string>, noneLabel: string) {
      return Array.from(m.entries())
        .map(([value, count]) => ({
          value,
          label: value === "__none__" ? noneLabel : (labels[value] ?? value),
          count,
        }))
        .sort((a, b) => b.count - a.count);
    }

    const feedbackList = Array.from(feedbackTotals.entries())
      .map(([value, count]) => ({
        value,
        label: feedbackLabels[value] ?? value,
        count,
        bySource: serialiseInner(bySource.get(value) ?? new Map(), sourceLabels, "(No source)"),
        byAction: serialiseInner(byAction.get(value) ?? new Map(), actionLabels, "Direct booking (no form)"),
      }))
      .sort((a, b) => b.count - a.count);

    return { total, feedback: feedbackList };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
