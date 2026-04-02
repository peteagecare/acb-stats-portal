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

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing params" }, { status: 400 });

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  // Count contacts created in range WITHOUT a conversion_action
  const noActionBody = {
    filterGroups: [{
      filters: [
        { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
        { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
        { propertyName: "conversion_action", operator: "NOT_HAS_PROPERTY" },
      ],
    }],
    properties: ["createdate"],
    limit: 1,
  };

  // Count contacts with visit booked but NO conversion_action
  const visitNoActionBody = {
    filterGroups: [{
      filters: [
        { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
        { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
        { propertyName: "conversion_action", operator: "NOT_HAS_PROPERTY" },
        { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "HAS_PROPERTY" },
      ],
    }],
    properties: ["createdate"],
    limit: 1,
  };

  const [noActionRes, visitNoActionRes] = await Promise.all([
    fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(noActionBody),
    }),
    fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(visitNoActionBody),
    }),
  ]);

  const noAction = noActionRes.ok ? (await noActionRes.json()).total ?? 0 : 0;
  const visitNoAction = visitNoActionRes.ok ? (await visitNoActionRes.json()).total ?? 0 : 0;

  return Response.json({
    contactsWithoutSource: noAction,
    visitsWithoutSource: visitNoAction,
  });
}
