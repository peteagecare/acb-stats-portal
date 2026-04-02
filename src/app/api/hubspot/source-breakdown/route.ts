import { NextRequest } from "next/server";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

const PROSPECT_ACTIONS = [
  "Brochure Download Form", "Flipbook Form", "VAT Exempt Checker",
  "Pricing Guide", "Physical Brochure Request", "Newsletter Sign Up",
];

const LEAD_ACTIONS = [
  "Brochure - Call Me", "Request A Callback Form", "Contact Form",
  "Free Home Design Form", "Phone Call", "Walk In Bath Form",
  "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit",
];

function londonDateToUtcMs(dateStr: string, time: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "shortOffset",
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

async function hubspotSearch(token: string, filters: Record<string, unknown>[]): Promise<number> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filterGroups: [{ filters }], properties: ["conversion_action"], limit: 1 }),
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HubSpot API error: ${res.status}`);
    const data = await res.json();
    return data.total ?? 0;
  }
  return 0;
}

const SOURCE_CATEGORIES: Record<string, string> = {
  "Google Ads": "PPC", "Bing Ads": "PPC", "Facebook Ads": "PPC",
  "Organic Search": "SEO", "AI": "SEO", "Directory Referral": "SEO",
  "Organic Social": "Content", "Organic YouTube": "Content",
};

function getCategory(value: string): string {
  return SOURCE_CATEGORIES[value] ?? "Other";
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing required params: from, to" }, { status: 400 });

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  // Get source options
  const propRes = await fetch(`${HUBSPOT_API}/crm/v3/properties/contacts/original_lead_source`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const propData = await propRes.json();
  const options: { value: string }[] = propData.options ?? [];

  // Group sources by category
  const categorySourceValues: Record<string, string[]> = { PPC: [], SEO: [], Content: [], Other: [] };
  for (const opt of options) {
    categorySourceValues[getCategory(opt.value)].push(opt.value);
  }

  const results: Record<string, { prospects: number; leads: number }> = {
    PPC: { prospects: 0, leads: 0 },
    SEO: { prospects: 0, leads: 0 },
    Content: { prospects: 0, leads: 0 },
    Other: { prospects: 0, leads: 0 },
  };

  const dateFilters = [
    { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
    { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
  ];

  // 8 queries total: 4 categories x 2 types (prospect/lead)
  // Run them one at a time with delays to avoid rate limits
  for (const cat of ["PPC", "SEO", "Content", "Other"] as const) {
    const sourceValues = categorySourceValues[cat];
    if (sourceValues.length === 0) continue;

    // Prospects for this category
    results[cat].prospects = await hubspotSearch(token, [
      ...dateFilters,
      { propertyName: "original_lead_source", operator: "IN", values: sourceValues },
      { propertyName: "conversion_action", operator: "IN", values: PROSPECT_ACTIONS },
    ]);

    await new Promise((r) => setTimeout(r, 500));

    // Leads for this category
    results[cat].leads = await hubspotSearch(token, [
      ...dateFilters,
      { propertyName: "original_lead_source", operator: "IN", values: sourceValues },
      { propertyName: "conversion_action", operator: "IN", values: LEAD_ACTIONS },
    ]);

    await new Promise((r) => setTimeout(r, 500));
  }

  return Response.json({ breakdown: results });
}
