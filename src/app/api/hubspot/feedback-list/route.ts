import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * GET /api/hubspot/feedback-list?from=&to=&feedback=Home+Visit+Booked&source=Google+Ads
 *
 * Returns contacts with outreach feedback in the date range,
 * optionally filtered by feedback value and/or lead source.
 */
export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const feedback = searchParams.get("feedback"); // optional: filter by feedback value
  const source = searchParams.get("source"); // optional: filter by lead source label

  if (!from || !to) {
    return Response.json({ error: "Missing required params: from, to" }, { status: 400 });
  }

  const key = cacheKey("feedback-list", { from, to, feedback: feedback ?? undefined, source: source ?? undefined });
  const data = await cached(key, TTL.SHORT, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 40;
    const allContacts: {
      id: string;
      name: string;
      email: string;
      phone: string;
      source: string;
      action: string;
      feedback: string;
      outreachDate: string;
    }[] = [];

    do {
      const filters: Record<string, unknown>[] = [
        { propertyName: "hs_first_outreach_date", operator: "GTE", value: fromMs.toString() },
        { propertyName: "hs_first_outreach_date", operator: "LTE", value: toMs.toString() },
        { propertyName: "initial_outreach_feedback", operator: "HAS_PROPERTY" },
        LIFECYCLE_EXCLUSION_FILTER,
      ];
      if (feedback) {
        filters.push({ propertyName: "initial_outreach_feedback", operator: "EQ", value: feedback });
      }
      if (source) {
        filters.push({ propertyName: "original_lead_source", operator: "EQ", value: source });
      }

      const body: Record<string, unknown> = {
        filterGroups: [{ filters }],
        properties: [
          "firstname", "lastname", "email", "phone", "mobilephone",
          "original_lead_source", "conversion_action",
          "initial_outreach_feedback", "hs_first_outreach_date",
        ],
        limit: 100,
        sorts: [{ propertyName: "hs_first_outreach_date", direction: "DESCENDING" }],
      };
      if (after) body.after = after;

      const result = await hubspotSearch(token, body);
      for (const c of result.results ?? []) {
        allContacts.push({
          id: c.id,
          name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(" ") || "Unknown",
          email: c.properties?.email ?? "",
          phone: c.properties?.phone || c.properties?.mobilephone || "",
          source: c.properties?.original_lead_source ?? "",
          action: c.properties?.conversion_action ?? "",
          feedback: c.properties?.initial_outreach_feedback ?? "",
          outreachDate: c.properties?.hs_first_outreach_date ?? "",
        });
      }

      after = result.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    return { contacts: allContacts };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
