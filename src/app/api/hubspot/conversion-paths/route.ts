import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, HUBSPOT_API, PROSPECT_ACTIONS_SET, LEAD_ACTIONS_SET } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * "Customer Journeys" — the full sequence of conversion actions each
 * contact took before booking a home visit, grouped and counted.
 *
 * Step 1: Search contacts whose visit was booked in the period.
 * Step 2: For each contact, fetch their form submission history via
 *         the legacy profile API (v1).
 * Step 3: Map each form to a clean action name, dedup consecutive
 *         repeats, build a path string.
 * Step 4: Group by path, count, return sorted.
 *
 * The result lets you see things like:
 *   "Brochure Download → Free Home Design Form → Home Visit"  12
 *   "Free Home Design Form → Home Visit"                       8
 *   "Brochure Download → Contact Form → Home Visit"            5
 */

const FORM_TITLE_MAP: Record<string, string> = {
  "#brochuredownload_popup .elementor-form": "Brochure Download",
  "#brochuredownload_homepage .elementor-form": "Brochure Download",
  "#walkinbaths_brochuredownload_popup .elementor-form": "Brochure Download",
  "PDF Brochure download form": "Brochure Download",
  "Contact Form": "Contact Form",
  "Free Home Design": "Free Home Design Form",
  "Brochure Request": "Physical Brochure Request",
  "VAT Exempt Form": "VAT Exemption Checker",
};

/** Partial-match rules for messy Gravity Forms / gform titles. */
function classifyForm(title: string): string | null {
  // Exact match first
  if (FORM_TITLE_MAP[title]) return FORM_TITLE_MAP[title];

  const lower = title.toLowerCase();

  // Skip newsletters / unrelated forms
  if (lower.includes("newsletter") || lower.includes("sign-up")) return null;

  // Brochure variants
  if (lower.includes("brochure") && (lower.includes("download") || lower.includes("popup") || lower.includes("elementor")))
    return "Brochure Download";
  if (lower.includes("brochure") && lower.includes("request"))
    return "Physical Brochure Request";
  if (lower.includes("brochure"))
    return "Brochure Download";

  // Home visit / home design / consultation
  if (lower.includes("home design") || lower.includes("home survey") || lower.includes("consultation") || lower.includes("home visit"))
    return "Free Home Design Form";

  // Walk-in bath form
  if (lower.includes("walk") && lower.includes("bath"))
    return "Walk In Bath Form";

  // VAT
  if (lower.includes("vat"))
    return "VAT Exemption Checker";

  // Pricing guide / flipbook
  if (lower.includes("pricing"))
    return "Pricing Guide";
  if (lower.includes("flipbook"))
    return "Flipbook Form";

  // Callback
  if (lower.includes("callback") || lower.includes("call me") || lower.includes("call back"))
    return "Request A Callback Form";

  // Contact form variants
  if (lower.includes("contact"))
    return "Contact Form";

  // Unknown — skip rather than pollute with #gform_X
  if (title.startsWith("#gform") || title.startsWith("#")) return null;

  return title; // Use raw title for anything else
}

async function fetchFormSubmissions(
  token: string,
  contactId: string,
): Promise<{ title: string; timestamp: number }[]> {
  try {
    const res = await fetch(
      `${HUBSPOT_API}/contacts/v1/contact/vid/${contactId}/profile`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data["form-submissions"] ?? []).map(
      (s: { title?: string; timestamp?: number }) => ({
        title: s.title ?? "",
        timestamp: s.timestamp ?? 0,
      }),
    );
  } catch {
    return [];
  }
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

  const key = cacheKey("conversion-paths", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    // 1. Find all contacts who booked a visit in the period
    const contactIds: string[] = [];
    let after: string | undefined;
    let pages = 0;
    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "GTE", value: fromMs.toString() },
              { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "LTE", value: toMs.toString() },
              { propertyName: "initial_visit_booked_", operator: "NEQ", value: "Cancelled" },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: ["firstname"],
        limit: 100,
        sorts: [{ propertyName: "date_that_initial_visit_booked_is_set_to_yes", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const result = await hubspotSearch(token, body);
      for (const c of result.results ?? []) {
        contactIds.push(c.id);
      }
      after = result.paging?.next?.after;
      pages++;
      if (pages >= 20) break;
    } while (after);

    // 2. Fetch form submission history per contact (batch 6 concurrent)
    const BATCH = 6;
    const contactPaths: string[][] = [];

    for (let i = 0; i < contactIds.length; i += BATCH) {
      const batch = contactIds.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((id) => fetchFormSubmissions(token, id)),
      );
      for (const subs of results) {
        // Sort by timestamp, map to clean action names, dedup consecutive
        const sorted = subs.sort((a, b) => a.timestamp - b.timestamp);
        const steps: string[] = [];
        for (const s of sorted) {
          const action = classifyForm(s.title);
          if (!action) continue;
          // Deduplicate consecutive same action
          if (steps.length === 0 || steps[steps.length - 1] !== action) {
            steps.push(action);
          }
        }
        contactPaths.push(steps);
      }
      // Small delay between batches
      if (i + BATCH < contactIds.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // 3. Build path strings and count
    const pathCounts = new Map<string, number>();
    let noFormCount = 0;
    for (const steps of contactPaths) {
      if (steps.length === 0) {
        noFormCount += 1;
        continue;
      }
      const pathStr = [...steps, "Home Visit Booked"].join(" → ");
      pathCounts.set(pathStr, (pathCounts.get(pathStr) ?? 0) + 1);
    }

    const paths = Array.from(pathCounts.entries())
      .map(([path, count]) => {
        const steps = path.split(" → ");
        return {
          path,
          steps: steps.map((s) => ({
            name: s,
            type: s === "Home Visit Booked"
              ? "visit"
              : PROSPECT_ACTIONS_SET.has(s)
                ? "prospect"
                : LEAD_ACTIONS_SET.has(s)
                  ? "lead"
                  : "other",
          })),
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      totalContacts: contactIds.length,
      noFormCount,
      paths,
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
