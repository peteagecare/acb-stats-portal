import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

/** Friendly labels for form titles / conversion actions */
const FORM_LABELS: Record<string, string> = {
  "Brochure Download Form": "Brochure Download",
  "Flipbook Form": "Flipbook",
  "VAT Exempt Checker": "VAT Exemption Check",
  "Pricing Guide": "Pricing Guide",
  "Physical Brochure Request": "Physical Brochure",
  "Newsletter Sign Up": "Newsletter",
  "Brochure - Call Me": "Brochure - Call Me",
  "Request A Callback Form": "Callback Request",
  "Contact Form": "Contact Form",
  "Free Home Design Form": "Home Design Form",
  "Phone Call": "Phone Call",
  "Walk In Bath Form": "Walk In Bath Form",
  "Direct Email": "Direct Email",
  "Brochure - Home Visit": "Brochure - Home Visit",
  "Pricing Guide Home Visit": "Pricing Guide Home Visit",
};

function friendlyName(raw: string): string {
  return FORM_LABELS[raw] ?? raw;
}

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

async function hubspotFetch(url: string, token: string, options?: RequestInit) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      cache: "no-store",
      ...options,
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
      throw new Error(`HubSpot ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }
  throw new Error("HubSpot request failed after retries");
}

/* ── Step 1: search contacts in period ── */

interface ContactInfo {
  id: string;
  conversionAction: string | null;
  visitBooked: boolean;
  visitCancelled: boolean;
  wonDate: string | null;
  firstEmailTs: number | null;
}

async function searchContacts(
  token: string,
  fromMs: number,
  toMs: number,
): Promise<ContactInfo[]> {
  const contacts: ContactInfo[] = [];
  let after: string | undefined;
  let pages = 0;

  // Deduplicate contacts across filter groups (a contact may match multiple)
  const seen = new Set<string>();

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        // Created in period
        {
          filters: [
            { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
            { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
            LIFECYCLE_EXCLUSION_FILTER,
          ],
        },
        // Home visit booked in period (even if created earlier)
        {
          filters: [
            { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "GTE", value: fromMs.toString() },
            { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "LTE", value: toMs.toString() },
            LIFECYCLE_EXCLUSION_FILTER,
          ],
        },
        // Deal won in period (even if created earlier)
        {
          filters: [
            { propertyName: "won_date", operator: "GTE", value: fromMs.toString() },
            { propertyName: "won_date", operator: "LTE", value: toMs.toString() },
            LIFECYCLE_EXCLUSION_FILTER,
          ],
        },
      ],
      properties: [
        "conversion_action",
        "date_that_initial_visit_booked_is_set_to_yes",
        "initial_visit_booked_",
        "won_date",
        "hs_email_first_send_date",
      ],
      limit: 100,
      sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
    };
    if (after) body.after = after;

    const data = await hubspotFetch(
      `${HUBSPOT_API}/crm/v3/objects/contacts/search`,
      token,
      { method: "POST", body: JSON.stringify(body) },
    );

    for (const c of data.results ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const props = c.properties ?? {};
      const emailTs = props.hs_email_first_send_date
        ? new Date(props.hs_email_first_send_date).getTime()
        : null;
      contacts.push({
        id: c.id,
        conversionAction: props.conversion_action || null,
        visitBooked: !!props.date_that_initial_visit_booked_is_set_to_yes,
        visitCancelled: props.initial_visit_booked_ === "Cancelled",
        wonDate: props.won_date || null,
        firstEmailTs: Number.isFinite(emailTs) ? emailTs : null,
      });
    }

    after = data.paging?.next?.after;
    pages++;
  } while (after && pages < 80);

  return contacts;
}

/* ── Step 2: batch-fetch form submissions via v1 contacts API ── */

interface FormSubmission {
  title: string;
  timestamp: number;
}

async function fetchFormSubmissions(
  token: string,
  ids: string[],
): Promise<Map<string, FormSubmission[]>> {
  const result = new Map<string, FormSubmission[]>();

  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const params = new URLSearchParams();
    for (const id of batch) params.append("vid", id);
    params.set("formSubmissionMode", "all");
    params.set("propertyMode", "value_only");

    const data = await hubspotFetch(
      `${HUBSPOT_API}/contacts/v1/contact/vids/batch/?${params.toString()}`,
      token,
    );

    for (const [vid, contact] of Object.entries(data)) {
      const c = contact as { "form-submissions"?: { title?: string; timestamp?: number }[] };
      const submissions = (c["form-submissions"] ?? [])
        .filter((f): f is { title: string; timestamp: number } => !!f.title && !!f.timestamp)
        .map((f) => ({ title: f.title, timestamp: f.timestamp }))
        .sort((a, b) => a.timestamp - b.timestamp);
      result.set(vid, submissions);
    }

    if (i + 100 < ids.length) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  return result;
}

/* ── Step 3: build journeys ── */

interface TimelineEvent {
  label: string;
  timestamp: number;
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

  try {
    const contacts = await searchContacts(token, fromMs, toMs);

    if (contacts.length === 0) {
      return Response.json({ journeys: [], totalContacts: 0 });
    }

    const ids = contacts.map((c) => c.id);
    const formSubs = await fetchFormSubmissions(token, ids);

    // Build a journey per contact
    const pathCounts = new Map<string, number>();

    for (const c of contacts) {
      const events: TimelineEvent[] = [];

      // Form submissions (chronological, all of them)
      const subs = formSubs.get(c.id) ?? [];
      for (const s of subs) {
        events.push({ label: friendlyName(s.title), timestamp: s.timestamp });
      }

      // conversion_action — add if it represents a non-form interaction
      // (Phone Call, Direct Email, etc.) and no form submission already covers it
      if (c.conversionAction) {
        const label = friendlyName(c.conversionAction);
        const alreadyInForms = events.some((e) => e.label === label);
        if (!alreadyInForms) {
          // Place it at the start (it's the initial interaction that brought them in)
          events.unshift({ label, timestamp: 0 });
        }
      }

      // First email engagement
      if (c.firstEmailTs) {
        events.push({ label: "First Email", timestamp: c.firstEmailTs });
      }

      // Sort all events by timestamp
      events.sort((a, b) => a.timestamp - b.timestamp);

      // Build the step labels (dedupe consecutive identical steps)
      const steps: string[] = [];
      for (const e of events) {
        steps.push(e.label);
      }

      // Append milestones (not time-sorted — always at the end)
      if (c.visitBooked && !c.visitCancelled) {
        steps.push("Home Visit");
      } else if (c.visitBooked && c.visitCancelled) {
        steps.push("Home Visit (Cancelled)");
      }
      if (c.wonDate) {
        steps.push("Won");
      }

      if (steps.length === 0) continue;

      const pathKey = steps.join(" → ");
      pathCounts.set(pathKey, (pathCounts.get(pathKey) ?? 0) + 1);
    }

    const journeys = Array.from(pathCounts.entries())
      .map(([path, count]) => ({
        path,
        steps: path.split(" → "),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return Response.json({
      journeys,
      totalContacts: contacts.length,
    });
  } catch (e) {
    console.error("[customer-journeys] error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "HubSpot request failed" },
      { status: 502 },
    );
  }
}
