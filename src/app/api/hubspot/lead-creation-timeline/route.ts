import { NextRequest } from "next/server";
import {
  LIFECYCLE_EXCLUSION_FILTER,
  EXCLUDED_LIFECYCLE_STAGES,
} from "@/lib/hubspot-exclusions";

/**
 * Lead Creation Timeline — cohort view.
 *
 * Fetches ALL contacts created in the selected period, then classifies each
 * into the same funnel buckets used by the top-of-dashboard funnel:
 *   Contacts → Prospects → Leads → Home Visits → Won Jobs
 * Plus: Lost Jobs (has a deal in closedlost stage) and Other.
 *
 * Classification uses conversion_action (Prospect vs Lead), visit booking
 * date (Home Visits), lifecycle stage + won_date (Won), deals search (Lost),
 * and original_lead_source for source breakdown.
 */

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

const PROSPECT_ACTIONS = new Set([
  "Brochure Download Form",
  "Flipbook Form",
  "VAT Exempt Checker",
  "Pricing Guide",
  "Physical Brochure Request",
  "Newsletter Sign Up",
]);

const LEAD_ACTIONS = new Set([
  "Brochure - Call Me",
  "Request A Callback Form",
  "Contact Form",
  "Free Home Design Form",
  "Phone Call",
  "Walk In Bath Form",
  "Direct Email",
  "Brochure - Home Visit",
  "Pricing Guide Home Visit",
]);

// Won lifecycle stages
const WON_STAGES = new Set(["151694551", "151694559"]); // Won-Waiting, Completed

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

async function hubspotFetchRaw(
  url: string,
  token: string,
  options?: RequestInit
) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok)
      throw new Error(
        `HubSpot API error: ${res.status} ${await res.text()}`
      );
    return res.json();
  }
  throw new Error("HubSpot request failed after retries");
}

async function hubspotSearch(
  token: string,
  objectType: string,
  body: object
) {
  return hubspotFetchRaw(
    `${HUBSPOT_API}/crm/v3/objects/${objectType}/search`,
    token,
    { method: "POST", body: JSON.stringify(body) }
  );
}

async function fetchPropertyLabels(
  token: string,
  prop: string
): Promise<Map<string, string>> {
  try {
    const data = await hubspotFetchRaw(
      `${HUBSPOT_API}/crm/v3/properties/contacts/${prop}`,
      token
    );
    return new Map(
      (data.options ?? []).map((o: { value: string; label: string }) => [
        o.value,
        o.label ?? o.value,
      ])
    );
  } catch {
    return new Map();
  }
}

/**
 * Find all contact IDs that have a deal in the closedlost stage.
 * Uses deals/search + associations to get the linked contact IDs.
 */
async function fetchLostContactIds(token: string): Promise<Set<string>> {
  const lostContactIds = new Set<string>();
  let after: string | undefined;
  const MAX_PAGES = 20;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "dealstage",
              operator: "EQ",
              value: "closedlost",
            },
          ],
        },
      ],
      properties: ["dealstage"],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const data = await hubspotSearch(token, "deals", body);
    const dealIds: string[] = (data.results ?? []).map(
      (d: { id: string }) => d.id
    );

    if (dealIds.length === 0) break;

    // Batch get associations: deals → contacts
    const ASSOC_BATCH = 100;
    for (let i = 0; i < dealIds.length; i += ASSOC_BATCH) {
      const batch = dealIds.slice(i, i + ASSOC_BATCH);
      const assocData = await hubspotFetchRaw(
        `${HUBSPOT_API}/crm/v4/associations/deals/contacts/batch/read`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ inputs: batch.map((id) => ({ id })) }),
        }
      );
      for (const result of assocData.results ?? []) {
        for (const to of result.to ?? []) {
          lostContactIds.add(to.toObjectId?.toString() ?? to.id?.toString());
        }
      }
    }

    after = data.paging?.next?.after;
    if (!after || (data.results ?? []).length < 100) break;
    if ((page + 1) % 3 === 0) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return lostContactIds;
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token)
    return Response.json(
      { error: "Missing HUBSPOT_ACCESS_TOKEN" },
      { status: 500 }
    );

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to)
    return Response.json(
      { error: "Missing required params: from, to" },
      { status: 400 }
    );

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  // Kick off parallel lookups
  const sourceLabelsPromise = fetchPropertyLabels(token, "original_lead_source");
  const lostContactIdsPromise = fetchLostContactIds(token);

  // Page through all contacts created in the period
  const contacts: {
    id: string;
    properties: Record<string, string | null>;
  }[] = [];
  let after: string | undefined;
  const MAX_PAGES = 80;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "createdate",
              operator: "GTE",
              value: fromMs.toString(),
            },
            {
              propertyName: "createdate",
              operator: "LTE",
              value: toMs.toString(),
            },
            LIFECYCLE_EXCLUSION_FILTER,
          ],
        },
      ],
      properties: [
        "lifecyclestage",
        "original_lead_source",
        "conversion_action",
        "date_that_initial_visit_booked_is_set_to_yes",
        "won_date",
      ],
      limit: 100,
      sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      ...(after ? { after } : {}),
    };

    const data = await hubspotSearch(token, "contacts", body);
    const results = data.results ?? [];
    contacts.push(
      ...results.map((r: { id: string; properties: Record<string, string | null> }) => ({
        id: r.id,
        properties: r.properties,
      }))
    );

    after = data.paging?.next?.after;
    if (!after || results.length < 100) break;
    if ((page + 1) % 3 === 0) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Await parallel lookups
  const sourceLabels = await sourceLabelsPromise;
  const lostContactIds = await lostContactIdsPromise;

  // Funnel counters
  let total = 0;
  let prospects = 0;
  let leads = 0;
  let homeVisits = 0;
  let wonJobs = 0;
  let lostJobs = 0;
  let other = 0;

  // Source breakdown
  const bySource = new Map<
    string,
    {
      contacts: number;
      prospects: number;
      leads: number;
      homeVisits: number;
      wonJobs: number;
      lostJobs: number;
    }
  >();

  function getSource(key: string) {
    let s = bySource.get(key);
    if (!s) {
      s = {
        contacts: 0,
        prospects: 0,
        leads: 0,
        homeVisits: 0,
        wonJobs: 0,
        lostJobs: 0,
      };
      bySource.set(key, s);
    }
    return s;
  }

  for (const c of contacts) {
    const stage = c.properties.lifecyclestage ?? "";
    if (EXCLUDED_LIFECYCLE_STAGES.includes(stage)) continue;

    const action = c.properties.conversion_action ?? "";
    const visitBooked =
      !!c.properties.date_that_initial_visit_booked_is_set_to_yes;
    const won = !!c.properties.won_date || WON_STAGES.has(stage);
    const lost = lostContactIds.has(c.id);
    const sourceKey = c.properties.original_lead_source || "(No source)";

    total++;
    const src = getSource(sourceKey);
    src.contacts++;

    // Classify into the highest funnel stage reached
    if (won) {
      wonJobs++;
      src.wonJobs++;
    } else if (lost) {
      lostJobs++;
      src.lostJobs++;
    } else if (visitBooked) {
      homeVisits++;
      src.homeVisits++;
    } else if (LEAD_ACTIONS.has(action)) {
      leads++;
      src.leads++;
    } else if (PROSPECT_ACTIONS.has(action)) {
      prospects++;
      src.prospects++;
    } else {
      other++;
    }
  }

  // Build funnel steps
  const funnel = [
    { label: "Contacts", count: total, colour: "#6366F1" },
    { label: "Prospects", count: prospects, colour: "#F59E0B" },
    { label: "Leads", count: leads, colour: "#0071E3" },
    { label: "Home Visits", count: homeVisits, colour: "#10B981" },
    { label: "Won Jobs", count: wonJobs, colour: "#059669" },
    { label: "Lost Jobs", count: lostJobs, colour: "#EF4444" },
    { label: "Other", count: other, colour: "#94A3B8" },
  ];

  // Build source list sorted by contacts desc
  const sources = Array.from(bySource.entries())
    .map(([value, s]) => ({
      label:
        value === "(No source)"
          ? "(No source)"
          : sourceLabels.get(value) ?? value,
      ...s,
    }))
    .sort((a, b) => b.contacts - a.contacts);

  return Response.json({ total, funnel, sources });
}
