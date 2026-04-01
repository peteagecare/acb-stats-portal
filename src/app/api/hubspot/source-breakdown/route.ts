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

async function hubspotFetch(path: string, token: string, options?: RequestInit) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HubSpot API error: ${res.status} ${await res.text()}`);
    return res.json();
  }
}

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

function getCategory(value: string): string {
  return SOURCE_CATEGORIES[value] ?? "Other";
}

async function countSourceAction(
  token: string,
  fromMs: number,
  toMs: number,
  sourceValue: string | null,
  actionValues: string[]
): Promise<number> {
  const filters: { propertyName: string; operator: string; value?: string; values?: string[] }[] = [
    { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
    { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
    { propertyName: "conversion_action", operator: "IN", values: actionValues },
  ];

  if (sourceValue !== null) {
    filters.push({ propertyName: "original_lead_source", operator: "EQ", value: sourceValue });
  }

  const body = {
    filterGroups: [{ filters }],
    properties: ["conversion_action"],
    limit: 1,
  };

  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.total ?? 0;
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

  // Get all source options
  const propData = await hubspotFetch("/crm/v3/properties/contacts/original_lead_source", token);
  const options: { value: string; label: string }[] = propData.options ?? [];

  // Group sources by category
  const categories = ["PPC", "SEO", "Content", "Other"] as const;
  const categorySourceValues: Record<string, string[]> = { PPC: [], SEO: [], Content: [], Other: [] };
  for (const opt of options) {
    const cat = getCategory(opt.value);
    categorySourceValues[cat].push(opt.value);
  }

  // For each category, count prospects and leads (2 queries per category = 8 total)
  const BATCH_SIZE = 4;
  type Query = { category: string; type: "prospects" | "leads"; sourceValues: string[]; actions: string[] };
  const queries: Query[] = [];
  for (const cat of categories) {
    if (categorySourceValues[cat].length === 0) continue;
    queries.push({ category: cat, type: "prospects", sourceValues: categorySourceValues[cat], actions: PROSPECT_ACTIONS });
    queries.push({ category: cat, type: "leads", sourceValues: categorySourceValues[cat], actions: LEAD_ACTIONS });
  }

  const results: Record<string, { prospects: number; leads: number }> = {};
  for (const cat of categories) results[cat] = { prospects: 0, leads: 0 };

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const counts = await Promise.all(
      batch.map(async (q) => {
        // Sum across all sources in this category
        let total = 0;
        for (const sv of q.sourceValues) {
          total += await countSourceAction(token, fromMs, toMs, sv, q.actions);
        }
        return { category: q.category, type: q.type, count: total };
      })
    );
    for (const c of counts) {
      results[c.category][c.type] = c.count;
    }
    if (i + BATCH_SIZE < queries.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return Response.json({ breakdown: results });
}
