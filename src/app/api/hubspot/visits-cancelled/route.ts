import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotFetch, hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Count of home visits that were SET TO CANCELLED inside the period.
 *
 * Uses the contact-level date property whose label is
 * "Date That Home Visit Is Set To Cancelled". The internal property name is
 * resolved at runtime by listing all contact properties and matching on label,
 * cached for an hour, so we don't have to hardcode an ID that could change.
 */

const TARGET_LABEL = "date that initial visit is cancelled";

async function resolveCancelledDateProperty(token: string): Promise<string> {
  return cached("prop:visits-cancelled-date-v2", TTL.VERY_LONG, async () => {
    const data = await hubspotFetch("/crm/v3/properties/contacts", token);
    const props = (data as { results?: { name: string; label: string; type: string }[] }).results ?? [];
    const exact = props.find((p) => (p.label ?? "").trim().toLowerCase() === TARGET_LABEL);
    if (exact) return exact.name;
    const fuzzy = props.find(
      (p) => /visit/i.test(p.label) && /cancel/i.test(p.label) && /date/i.test(p.label),
    );
    if (fuzzy) return fuzzy.name;
    const candidates = props
      .filter((p) => /cancel/i.test(p.label))
      .map((p) => `${p.label} (${p.name})`)
      .slice(0, 8)
      .join(", ");
    throw new Error(
      `Looking for label "${TARGET_LABEL}" — not found. Cancel-related props: ${candidates || "none"}`,
    );
  });
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

  const key = cacheKey("visits-cancelled", { from, to });
  try {
    const data = await cached(key, TTL.SHORT, async () => {
      const propertyName = await resolveCancelledDateProperty(token);
      const fromMs = londonDateToUtcMs(from, "00:00:00");
      const toMs = londonDateToUtcMs(to, "23:59:59");

      const body = {
        filterGroups: [
          {
            filters: [
              { propertyName, operator: "GTE", value: fromMs.toString() },
              { propertyName, operator: "LTE", value: toMs.toString() },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: [propertyName],
        limit: 1,
      };

      const result = await hubspotSearch(token, body);
      return { total: result.total ?? 0, propertyUsed: propertyName };
    });

    const isPast = to < new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
