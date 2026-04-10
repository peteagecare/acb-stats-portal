import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

const SOURCE_CATEGORIES: Record<string, string> = {
  "Google Ads": "PPC",
  "Bing Ads": "PPC",
  "Facebook Ads": "PPC",
  "Organic Search": "SEO",
  "AI": "SEO",
  "Directory Referral": "SEO",
  "Organic Social": "Content",
  "Organic YouTube": "Content",
};

function getSourceCategory(value: string): string {
  return SOURCE_CATEGORIES[value] ?? "Other";
}

const PROSPECT_ACTIONS = new Set([
  "Brochure Download Form", "Flipbook Form", "VAT Exempt Checker",
  "Pricing Guide", "Physical Brochure Request", "Newsletter Sign Up",
]);

const LEAD_ACTIONS = new Set([
  "Brochure - Call Me", "Request A Callback Form", "Contact Form",
  "Free Home Design Form", "Phone Call", "Walk In Bath Form",
  "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit",
]);

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

/**
 * Classify a contact into a funnel stage based on their properties.
 */
function classifyStage(action: string, visitBooked: boolean, won: boolean): string {
  if (won) return "Won Job";
  if (visitBooked) return "Home Visit";
  if (LEAD_ACTIONS.has(action)) return "Lead";
  if (PROSPECT_ACTIONS.has(action)) return "Prospect";
  return "Contact";
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
 * GET /api/hubspot/contact-list?from=YYYY-MM-DD&to=YYYY-MM-DD&stage=Contacts|Prospects|Leads|Home+Visits|Won+Jobs
 *
 * Returns all contacts created in the date range that match the given funnel
 * stage, with name, email, phone, source, action, stage, and HubSpot contact ID.
 */
export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const stage = searchParams.get("stage"); // "Contacts", "Prospects", "Leads", "Home Visits", "Won Jobs"
  const sourceCategory = searchParams.get("sourceCategory"); // optional: "PPC", "SEO", "Content", "Other"

  if (!from || !to || !stage) {
    return Response.json({ error: "Missing required params: from, to, stage" }, { status: 400 });
  }

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  try {
    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 80;
    const allContacts: {
      id: string;
      name: string;
      email: string;
      phone: string;
      source: string;
      action: string;
      stage: string;
      created: string;
      lastActivity: string;
      daysSinceActivity: number | null;
    }[] = [];

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
          "firstname",
          "lastname",
          "email",
          "phone",
          "mobilephone",
          "createdate",
          "conversion_action",
          "original_lead_source",
          "date_that_initial_visit_booked_is_set_to_yes",
          "won_date",
          "notes_last_updated",
          "hs_last_sales_activity_timestamp",
        ],
        limit: 100,
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      };
      if (after) body.after = after;

      const data = await hubspotSearch(token, body);

      for (const c of data.results ?? []) {
        const action = c.properties?.conversion_action ?? "";
        const visitBooked = !!c.properties?.date_that_initial_visit_booked_is_set_to_yes;
        const won = !!c.properties?.won_date;
        const contactStage = classifyStage(action, visitBooked, won);

        // Filter by requested stage — exact match only
        const stageNorm = stage.toLowerCase();
        let matches = false;
        if (stageNorm === "contacts") matches = contactStage === "Contact";
        else if (stageNorm === "prospects") matches = contactStage === "Prospect";
        else if (stageNorm === "leads") matches = contactStage === "Lead";
        else if (stageNorm === "home visits") matches = contactStage === "Home Visit";
        else if (stageNorm === "won jobs") matches = contactStage === "Won Job";

        if (!matches) continue;

        // Filter by source category if specified
        const contactSource = c.properties?.original_lead_source ?? "";
        if (sourceCategory) {
          const cat = getSourceCategory(contactSource);
          if (cat !== sourceCategory) continue;
        }

        const phone = c.properties?.phone || c.properties?.mobilephone || "";
        const lastActivity = c.properties?.hs_last_sales_activity_timestamp || c.properties?.notes_last_updated || "";
        let daysSinceActivity: number | null = null;
        if (lastActivity) {
          const actDate = new Date(lastActivity);
          const now = new Date();
          daysSinceActivity = Math.floor((now.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        allContacts.push({
          id: c.id,
          name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(" ") || "Unknown",
          email: c.properties?.email ?? "",
          phone,
          source: c.properties?.original_lead_source ?? "",
          action,
          stage: contactStage,
          created: c.properties?.createdate ?? "",
          lastActivity,
          daysSinceActivity,
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
