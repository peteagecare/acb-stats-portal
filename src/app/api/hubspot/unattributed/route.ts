import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

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

async function hubspotSearchWithRetry(token: string, body: object): Promise<number> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(`HubSpot search failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.total ?? 0;
  }
  throw new Error("HubSpot search failed after retries");
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing params" }, { status: 400 });

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  // Count contacts created in range with NO original_lead_source set —
  // these are the ones the dashboard warning labels as "without a source".
  // Matches what Pete sees when he filters HubSpot contacts by
  // "Original lead source is unknown".
  const noSourceBody = {
    filterGroups: [{
      filters: [
        { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
        { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
        { propertyName: "original_lead_source", operator: "NOT_HAS_PROPERTY" },
        LIFECYCLE_EXCLUSION_FILTER,
      ],
    }],
    properties: ["createdate"],
    limit: 1,
  };

  // Same set, narrowed to those who also booked a home visit
  const visitNoSourceBody = {
    filterGroups: [{
      filters: [
        { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
        { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
        { propertyName: "original_lead_source", operator: "NOT_HAS_PROPERTY" },
        { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "HAS_PROPERTY" },
        LIFECYCLE_EXCLUSION_FILTER,
      ],
    }],
    properties: ["createdate"],
    limit: 1,
  };

  try {
    const [noSource, visitNoSource] = await Promise.all([
      hubspotSearchWithRetry(token, noSourceBody),
      hubspotSearchWithRetry(token, visitNoSourceBody),
    ]);

    return Response.json({
      contactsWithoutSource: noSource,
      visitsWithoutSource: visitNoSource,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HubSpot request failed" },
      { status: 502 }
    );
  }
}
