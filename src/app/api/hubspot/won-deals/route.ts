import { NextRequest } from "next/server";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

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
      cache: "no-store",
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

// Won-Waiting lifecycle stage value
const WON_WAITING_STAGE = "151694551";
// Completed lifecycle stage value
const COMPLETED_STAGE = "151694559";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing required params: from, to" }, { status: 400 });

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  // Count contacts whose deal was created in the date range AND are in Won-Waiting or Completed stage
  // Using first_deal_created_date as the date the deal was won
  const stages = [WON_WAITING_STAGE, COMPLETED_STAGE];
  let total = 0;
  let totalValue = 0;

  for (const stage of stages) {
    const body = {
      filterGroups: [{
        filters: [
          { propertyName: "lifecyclestage", operator: "EQ", value: stage },
          { propertyName: "first_deal_created_date", operator: "GTE", value: fromMs.toString() },
          { propertyName: "first_deal_created_date", operator: "LTE", value: toMs.toString() },
        ],
      }],
      properties: ["lifecyclestage", "recent_deal_amount", "first_deal_created_date"],
      limit: 100,
    };

    const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
      method: "POST",
      body: JSON.stringify(body),
    });

    total += data.total ?? 0;

    // Sum deal values
    for (const contact of data.results ?? []) {
      const amt = parseFloat(contact.properties?.recent_deal_amount ?? "0");
      if (!isNaN(amt)) totalValue += amt;
    }
  }

  return Response.json({ total, totalValue: Math.round(totalValue) });
}
