import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

const PROSPECT_ACTIONS = [
  "Brochure Download Form",
  "Flipbook Form",
  "VAT Exempt Checker",
  "Pricing Guide",
  "Physical Brochure Request",
  "Newsletter Sign Up",
];

const LEAD_ACTIONS = [
  "Brochure - Call Me",
  "Request A Callback Form",
  "Contact Form",
  "Free Home Design Form",
  "Phone Call",
  "Walk In Bath Form",
  "Direct Email",
  "Brochure - Home Visit",
  "Pricing Guide Home Visit",
];

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchContacts(
  token: string,
  filterGroups: Record<string, unknown>[],
): Promise<number> {
  const body = {
    filterGroups,
    properties: ["email"],
    limit: 1,
  };

  const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HubSpot error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.total ?? 0;
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

  // Calculate previous period of the same duration
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevToDate = new Date(fromDate.getTime() - 1); // day before current from
  const prevFromDate = new Date(prevToDate.getTime() - durationMs);

  const prevFrom = prevFromDate.toISOString().split("T")[0];
  const prevTo = prevToDate.toISOString().split("T")[0];

  const prevFromMs = londonDateToUtcMs(prevFrom, "00:00:00");
  const prevToMs = londonDateToUtcMs(prevTo, "23:59:59");

  try {
    // 1. Contacts count
    const contacts = await searchContacts(token, [
      {
        filters: [
          {
            propertyName: "conversion_action",
            operator: "HAS_PROPERTY",
          },
          {
            propertyName: "createdate",
            operator: "GTE",
            value: prevFromMs.toString(),
          },
          {
            propertyName: "createdate",
            operator: "LTE",
            value: prevToMs.toString(),
          },
          LIFECYCLE_EXCLUSION_FILTER,
        ],
      },
    ]);

    await delay(500);

    // 2. Prospects count
    const prospectFilterGroups = PROSPECT_ACTIONS.map((action) => ({
      filters: [
        {
          propertyName: "conversion_action",
          operator: "EQ",
          value: action,
        },
        {
          propertyName: "createdate",
          operator: "GTE",
          value: prevFromMs.toString(),
        },
        {
          propertyName: "createdate",
          operator: "LTE",
          value: prevToMs.toString(),
        },
        LIFECYCLE_EXCLUSION_FILTER,
      ],
    }));
    const prospects = await searchContacts(token, prospectFilterGroups);

    await delay(500);

    // 3. Leads count
    const leadFilterGroups = LEAD_ACTIONS.map((action) => ({
      filters: [
        {
          propertyName: "conversion_action",
          operator: "EQ",
          value: action,
        },
        {
          propertyName: "createdate",
          operator: "GTE",
          value: prevFromMs.toString(),
        },
        {
          propertyName: "createdate",
          operator: "LTE",
          value: prevToMs.toString(),
        },
        LIFECYCLE_EXCLUSION_FILTER,
      ],
    }));
    const leads = await searchContacts(token, leadFilterGroups);

    await delay(500);

    // 4. Home visits count
    const homeVisits = await searchContacts(token, [
      {
        filters: [
          {
            propertyName: "date_that_initial_visit_booked_is_set_to_yes",
            operator: "GTE",
            value: prevFromMs.toString(),
          },
          {
            propertyName: "date_that_initial_visit_booked_is_set_to_yes",
            operator: "LTE",
            value: prevToMs.toString(),
          },
          LIFECYCLE_EXCLUSION_FILTER,
        ],
      },
    ]);

    await delay(500);

    // 5. Won jobs (count + value) — same logic as /api/hubspot/won-deals:
    //    contacts in Won-Waiting or Completed lifecycle stages whose
    //    first_deal_created_date falls in the previous period.
    const WON_WAITING_STAGE = "151694551";
    const COMPLETED_STAGE = "151694559";
    let wonJobs = 0;
    let wonValue = 0;
    for (const stage of [WON_WAITING_STAGE, COMPLETED_STAGE]) {
      const wonRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "lifecyclestage", operator: "EQ", value: stage },
                { propertyName: "first_deal_created_date", operator: "GTE", value: prevFromMs.toString() },
                { propertyName: "first_deal_created_date", operator: "LTE", value: prevToMs.toString() },
              ],
            },
          ],
          properties: ["recent_deal_amount"],
          limit: 100,
        }),
      });
      if (wonRes.ok) {
        const data = await wonRes.json();
        wonJobs += data.total ?? 0;
        for (const c of data.results ?? []) {
          const amt = parseFloat(c.properties?.recent_deal_amount ?? "0");
          if (!isNaN(amt)) wonValue += amt;
        }
      }
      await delay(500);
    }

    return Response.json({
      contacts,
      prospects,
      leads,
      homeVisits,
      wonJobs,
      wonValue: Math.round(wonValue),
      // Echo back the calculated previous period for the UI label
      from: prevFrom,
      to: prevTo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
