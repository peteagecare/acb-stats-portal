import { NextRequest } from "next/server";
import {
  LIFECYCLE_EXCLUSION_FILTER,
  EXCLUDED_LIFECYCLE_STAGES,
} from "@/lib/hubspot-exclusions";

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

async function hubspotFetch(
  path: string,
  token: string,
  options?: RequestInit
) {
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
    if (!res.ok)
      throw new Error(
        `HubSpot API error: ${res.status} ${await res.text()}`
      );
    return res.json();
  }
}

interface Contact {
  properties: Record<string, string | null>;
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

  // 1. Get lifecycle stage labels
  const propData = await hubspotFetch(
    "/crm/v3/properties/contacts/lifecyclestage",
    token
  );
  const stageOptions: { value: string; label: string; displayOrder: number }[] =
    propData.options ?? [];
  const stageLabelMap = new Map(stageOptions.map((o) => [o.value, o.label]));
  const stageOrderMap = new Map(
    stageOptions.map((o) => [o.value, o.displayOrder])
  );

  // 2. Page through all contacts created in the period
  const contacts: Contact[] = [];
  let after: string | undefined;
  const LIMIT = 100;
  const MAX_PAGES = 50; // safety cap: 5,000 contacts

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
      ],
      limit: LIMIT,
      ...(after ? { after } : {}),
    };

    const data = await hubspotFetch(
      "/crm/v3/objects/contacts/search",
      token,
      { method: "POST", body: JSON.stringify(body) }
    );

    const results: Contact[] = data.results ?? [];
    contacts.push(...results);

    after = data.paging?.next?.after;
    if (!after || results.length < LIMIT) break;

    // Rate limit pause every 3 pages
    if ((page + 1) % 3 === 0) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // 3. Group by current lifecycle stage
  const byStage = new Map<
    string,
    { label: string; count: number; order: number }
  >();
  // Group by source
  const bySource = new Map<string, { label: string; count: number }>();

  for (const c of contacts) {
    const stage = c.properties.lifecyclestage ?? "__none__";
    const source = c.properties.original_lead_source;
    const action = c.properties.conversion_action;

    // Skip excluded stages (belt-and-suspenders)
    if (EXCLUDED_LIFECYCLE_STAGES.includes(stage)) continue;

    // Stage grouping
    const existing = byStage.get(stage);
    if (existing) {
      existing.count++;
    } else {
      byStage.set(stage, {
        label: stageLabelMap.get(stage) ?? stage,
        count: 1,
        order: stageOrderMap.get(stage) ?? 999,
      });
    }

    // Source grouping
    const srcKey = source || "(No source)";
    const srcExisting = bySource.get(srcKey);
    if (srcExisting) {
      srcExisting.count++;
    } else {
      bySource.set(srcKey, { label: srcKey, count: 1 });
    }
  }

  // 4. Sort stages by display order, sources by count desc
  const stages = [...byStage.values()].sort((a, b) => a.order - b.order);
  const sources = [...bySource.values()].sort((a, b) => b.count - a.count);

  return Response.json({
    total: contacts.length,
    stages,
    sources,
  });
}
