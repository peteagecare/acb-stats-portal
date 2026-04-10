import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

function londonDateToUtcMs(dateStr: string, time: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZoneName: "shortOffset",
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
  results: { id: string; properties: Record<string, string | null> }[];
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

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  try {
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

      const data = await hubspotSearch(token, body);
      for (const c of data.results ?? []) {
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

      after = data.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    return Response.json({ contacts: allContacts });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HubSpot request failed" },
      { status: 502 },
    );
  }
}
