import { NextRequest } from "next/server";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

/**
 * Convert a date string (YYYY-MM-DD) + time to UTC milliseconds,
 * interpreted in Europe/London timezone. This ensures correct handling
 * across GMT/BST boundaries and works regardless of server timezone.
 */
function londonDateToUtcMs(dateStr: string, time: string): number {
  // Create a formatter that tells us the UTC offset for London on this date
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

  // Parse the target date as UTC first, then figure out London's offset
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);

  // Build a UTC date, then check what London's offset is at that moment
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const parts = formatter.formatToParts(new Date(utcGuess));
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "+00";
  // tzPart is like "GMT" or "GMT+1"
  const offsetMatch = tzPart.match(/([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

  // London time = UTC + offset, so UTC = London time - offset
  return Date.UTC(y, m - 1, d, hh - offsetHours, mm, ss);
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const source = searchParams.get("source");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!source || !from || !to) {
    return Response.json(
      { error: "Missing required params: source, from, to" },
      { status: 400 }
    );
  }

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  const filters = [
    {
      propertyName: "original_lead_source",
      operator: "EQ",
      value: source,
    },
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
      operator: "HAS_PROPERTY",
    },
  ];

  const body = {
    filterGroups: [{ filters }],
    properties: ["firstname", "lastname", "email", "createdate", "original_lead_source"],
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
    return Response.json({ error: err }, { status: res.status });
  }

  const data = await res.json();

  return Response.json({ total: data.total ?? 0 });
}
