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

async function countByStageInPeriod(token: string, stage: string, fromMs: number, toMs: number): Promise<number> {
  const body = {
    filterGroups: [{
      filters: [
        { propertyName: "lifecyclestage", operator: "EQ", value: stage },
        { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
        { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
      ],
    }],
    properties: ["lifecyclestage"],
    limit: 1,
  };
  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, { method: "POST", body: JSON.stringify(body) });
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

  const propData = await hubspotFetch("/crm/v3/properties/contacts/lifecyclestage", token);
  const options: { value: string; label: string; displayOrder: number }[] = propData.options ?? [];

  const BATCH_SIZE = 4;
  const counts: number[] = [];
  for (let i = 0; i < options.length; i += BATCH_SIZE) {
    const batch = options.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((opt) => countByStageInPeriod(token, opt.value, fromMs, toMs)));
    counts.push(...results);
    if (i + BATCH_SIZE < options.length) await new Promise((r) => setTimeout(r, 1500));
  }

  const stages = options
    .map((opt, i) => ({ label: opt.label, value: opt.value, count: counts[i], order: opt.displayOrder }))
    .sort((a, b) => a.order - b.order);

  return Response.json({ stages });
}
