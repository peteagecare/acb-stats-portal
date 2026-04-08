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

  const body = {
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
          {
            propertyName: "date_that_initial_visit_booked_is_set_to_yes",
            operator: "HAS_PROPERTY",
          },
          LIFECYCLE_EXCLUSION_FILTER,
        ],
      },
    ],
    properties: ["createdate", "date_that_initial_visit_booked_is_set_to_yes"],
    limit: 100,
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
  const results = data.results ?? [];

  if (results.length === 0) {
    return Response.json({ averageDays: 0, count: 0 });
  }

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  let totalDays = 0;
  let validCount = 0;

  for (const contact of results) {
    const created = contact.properties.createdate;
    const visitBooked =
      contact.properties.date_that_initial_visit_booked_is_set_to_yes;

    if (created && visitBooked) {
      const createdMs = new Date(created).getTime();
      const visitMs = new Date(visitBooked).getTime();
      const days = (visitMs - createdMs) / MS_PER_DAY;

      if (days >= 0) {
        totalDays += days;
        validCount++;
      }
    }
  }

  const averageDays =
    validCount > 0 ? Math.round((totalDays / validCount) * 10) / 10 : 0;

  return Response.json({ averageDays, count: validCount });
}
