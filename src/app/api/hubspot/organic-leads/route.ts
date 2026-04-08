import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

// Lead-level conversion actions — contacts with these are already counted in
// the "Form Leads" total, so we exclude them here to avoid double-counting.
// Anyone else who has a booked visit (prospects, no conversion action, etc.)
// is counted as an "organic lead".
const LEAD_ACTIONS = [
  "Brochure - Call Me", "Request A Callback Form", "Contact Form",
  "Free Home Design Form", "Phone Call", "Walk In Bath Form",
  "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit",
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

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  // Count contacts who:
  // 1. Had their visit booked in the date range (matches the Home Visits KPI's
  //    date semantics — booking date, NOT contact createdate)
  // 2. Are NOT already counted as a form lead (conversion_action not in LEAD_ACTIONS)
  //
  // Two filterGroups are used so we capture both:
  //   a) contacts with a non-lead conversion action
  //   b) contacts with no conversion action at all
  // (HubSpot's NOT_IN does not match contacts where the property is unset.)
  const baseFilters = [
    { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "GTE", value: fromMs.toString() },
    { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "LTE", value: toMs.toString() },
    LIFECYCLE_EXCLUSION_FILTER,
  ];

  const body = {
    filterGroups: [
      {
        filters: [
          ...baseFilters,
          { propertyName: "conversion_action", operator: "NOT_IN", values: LEAD_ACTIONS },
        ],
      },
      {
        filters: [
          ...baseFilters,
          { propertyName: "conversion_action", operator: "NOT_HAS_PROPERTY" },
        ],
      },
    ],
    properties: ["conversion_action", "date_that_initial_visit_booked_is_set_to_yes"],
    limit: 1,
  };

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
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ total: data.total ?? 0 });
  }

  return Response.json({ error: "HubSpot rate-limited after retries" }, { status: 502 });
}
