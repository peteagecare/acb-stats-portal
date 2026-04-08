import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

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

async function hubspotFetch(path: string, token: string, options?: RequestInit) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}${path}`, {
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
    if (!res.ok) {
      throw new Error(`HubSpot API error: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }
}

async function countContacts(
  token: string,
  fromMs: number,
  toMs: number,
  actionFilter:
    | { operator: "EQ"; value: string }
    | { operator: "NOT_HAS_PROPERTY" }
): Promise<number> {
  const filters = [
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
    {
      propertyName: "conversion_action",
      ...actionFilter,
    },
    LIFECYCLE_EXCLUSION_FILTER,
  ];

  const data = await hubspotFetch(
    "/crm/v3/objects/contacts/search",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters }],
        properties: ["conversion_action"],
        limit: 1,
      }),
    }
  );

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

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  // Fetch property definition to get all conversion action options
  const propData = await hubspotFetch(
    "/crm/v3/properties/contacts/conversion_action",
    token
  );

  const options: { value: string; label: string }[] = propData.options ?? [];

  // Count contacts for each action, batched to avoid rate limits
  const allQueries: Array<
    | { operator: "EQ"; value: string }
    | { operator: "NOT_HAS_PROPERTY" }
  > = options.map((opt) => ({ operator: "EQ" as const, value: opt.value }));

  const BATCH_SIZE = 4;
  const allCounts: number[] = [];

  for (let i = 0; i < allQueries.length; i += BATCH_SIZE) {
    const batch = allQueries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((q) => countContacts(token, fromMs, toMs, q))
    );
    allCounts.push(...results);
    if (i + BATCH_SIZE < allQueries.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const actions = options.map((opt, i) => ({
    label: opt.label,
    value: opt.value,
    count: allCounts[i],
  }));

  return Response.json({ actions });
}
