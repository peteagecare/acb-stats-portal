import { NextRequest } from "next/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

function londonDateToUtcMs(dateStr: string, time: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
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

async function queryHubSpot(from: string, to: string): Promise<string> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return "HubSpot not configured.";

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  try {
    const body = {
      filterGroups: [{
        filters: [
          { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
          { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
          { propertyName: "conversion_action", operator: "HAS_PROPERTY" },
          LIFECYCLE_EXCLUSION_FILTER,
        ],
      }],
      properties: [
        "conversion_action",
        "original_lead_source",
        "date_that_initial_visit_booked_is_set_to_yes",
        "initial_visit_booked_",
        "won_date",
        "recent_deal_amount",
      ],
      limit: 100,
      sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
    };

    let allContacts: Record<string, string | null>[] = [];
    let after: string | undefined;
    let pages = 0;

    do {
      const reqBody = after ? { ...body, after } : body;
      const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      if (!res.ok) return `HubSpot error: ${res.status}`;
      const data = await res.json();
      allContacts.push(...(data.results ?? []).map((c: { properties: Record<string, string | null> }) => c.properties));
      after = data.paging?.next?.after;
      pages++;
    } while (after && pages < 40);

    // Aggregate
    const PROSPECT_ACTIONS = new Set([
      "Brochure Download Form", "Flipbook Form", "VAT Exempt Checker",
      "Pricing Guide", "Physical Brochure Request", "Newsletter Sign Up",
    ]);
    const LEAD_ACTIONS = new Set([
      "Brochure - Call Me", "Request A Callback Form", "Contact Form",
      "Free Home Design Form", "Phone Call", "Walk In Bath Form",
      "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit",
    ]);

    let contacts = 0, prospects = 0, leads = 0, homeVisits = 0, cancelled = 0, wonJobs = 0, wonValue = 0;
    const sourceCount: Record<string, number> = {};
    const actionCount: Record<string, number> = {};

    for (const p of allContacts) {
      contacts++;
      const action = p.conversion_action ?? "";
      const source = p.original_lead_source ?? "(No source)";
      sourceCount[source] = (sourceCount[source] ?? 0) + 1;
      if (action) actionCount[action] = (actionCount[action] ?? 0) + 1;
      if (PROSPECT_ACTIONS.has(action)) prospects++;
      if (LEAD_ACTIONS.has(action)) leads++;
      if (p.date_that_initial_visit_booked_is_set_to_yes) {
        if (p.initial_visit_booked_ === "Cancelled") cancelled++;
        else homeVisits++;
      }
      if (p.won_date) {
        wonJobs++;
        wonValue += parseFloat(p.recent_deal_amount ?? "0") || 0;
      }
    }

    const sourcesStr = Object.entries(sourceCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ");
    const actionsStr = Object.entries(actionCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ");

    return `DATA FOR ${from} to ${to}:
Contacts: ${contacts}, Prospects: ${prospects}, Leads: ${leads}, Home Visits: ${homeVisits} (${cancelled} cancelled), Won Jobs: ${wonJobs} (£${wonValue.toLocaleString()})
Sources: ${sourcesStr}
Actions: ${actionsStr}`;
  } catch (e) {
    return `Error querying HubSpot: ${e instanceof Error ? e.message : "unknown"}`;
  }
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`ai-chat:${clientKey(request)}`, 20, 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });

  const { question, dashboardData, history } = await request.json();

  const d = dashboardData ?? {};
  const sections: string[] = [];

  sections.push(`CURRENTLY SELECTED PERIOD: ${d.dateFrom ?? "?"} to ${d.dateTo ?? "?"}`);

  sections.push(`KEY METRICS (current period):
- Website Visitors: ${d.visitors ?? "N/A"}
- Contacts: ${d.contacts ?? "N/A"}
- Prospects: ${d.prospects ?? "N/A"}
- Leads: ${d.leads ?? "N/A"}
- Home Visits Booked: ${d.homeVisits ?? "N/A"}
- Won Jobs: ${d.wonJobs ?? "N/A"} (value: £${(d.wonValue ?? 0).toLocaleString()})
- Unattributed contacts: ${d.unattributedContacts ?? "N/A"}
- Direct bookings (no lead form): ${d.organicLeads ?? "N/A"}`);

  if (d.prevContacts != null || d.prevLeads != null) {
    sections.push(`PREVIOUS PERIOD:
- Contacts: ${d.prevContacts ?? "N/A"}
- Leads: ${d.prevLeads ?? "N/A"}`);
  }

  if (d.sources?.length) {
    sections.push(`LEAD SOURCES:\n${d.sources.map((s: { label: string; count: number }) => `- ${s.label}: ${s.count}`).join("\n")}`);
  }

  if (d.conversionActions?.length) {
    sections.push(`CONVERSION ACTIONS:\n${d.conversionActions.map((a: { label: string; count: number }) => `- ${a.label}: ${a.count}`).join("\n")}`);
  }

  if (d.sourceBreakdown) {
    const sb = Object.entries(d.sourceBreakdown).map(
      ([k, v]) => `- ${k}: ${(v as { prospects: number; leads: number }).prospects} prospects, ${(v as { prospects: number; leads: number }).leads} leads`
    );
    sections.push(`SOURCE CATEGORY BREAKDOWN:\n${sb.join("\n")}`);
  }

  if (d.funnelTiming) {
    const ft = d.funnelTiming;
    sections.push(`FUNNEL TIMING:
- Prospect to Lead: ${ft.prospectToLead?.avgDays != null ? ft.prospectToLead.avgDays + " days" : "N/A"} (n=${ft.prospectToLead?.sample ?? 0})
- Lead to Visit: ${ft.leadToVisit?.avgDays != null ? ft.leadToVisit.avgDays + " days" : "N/A"} (n=${ft.leadToVisit?.sample ?? 0})
- Prospect to Visit: ${ft.prospectToVisit?.avgDays != null ? ft.prospectToVisit.avgDays + " days" : "N/A"} (n=${ft.prospectToVisit?.sample ?? 0})`);
  }

  if (d.wonBySource?.length) {
    sections.push(`WON JOBS BY SOURCE:\n${d.wonBySource.map((w: { label: string; count: number; value: number }) => `- ${w.label}: ${w.count} jobs, £${w.value.toLocaleString()}`).join("\n")}`);
  }

  const systemPrompt = `You are a marketing data analyst for Age Care Bathrooms, a UK company selling walk-in baths and accessible bathrooms to people aged 55+. Today is ${new Date().toISOString().split("T")[0]}.

You have access to their dashboard data for the currently selected period AND a tool to query HubSpot data for ANY date range.

RULES:
- Answer questions concisely using actual numbers
- Use £ for currency, format numbers with commas
- If calculating percentages, show both the percentage and the raw numbers
- Be direct and specific — no filler or caveats
- Keep answers to 3-4 sentences max unless the question requires more detail
- When comparing sources, always include conversion rates
- If the user asks about a different date range than what's currently selected, USE THE query_hubspot TOOL to get that data. Don't say you don't have it — fetch it.
- Dates should be in YYYY-MM-DD format when calling the tool

${sections.join("\n\n")}`;

  const tools = [{
    name: "query_hubspot",
    description: "Query HubSpot CRM data for any date range. Returns contacts, prospects, leads, home visits, won jobs, revenue, lead sources, and conversion actions for the specified period. Use this when the user asks about a date range different from the currently selected period.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const, description: "Start date in YYYY-MM-DD format" },
        to: { type: "string" as const, description: "End date in YYYY-MM-DD format" },
      },
      required: ["from", "to"],
    },
  }];

  const messages: { role: string; content: string | { type: string; tool_use_id?: string; content?: string }[] }[] = [];
  if (Array.isArray(history)) {
    for (const msg of history.slice(-6)) {
      messages.push({ role: msg.role === "ai" ? "assistant" : "user", content: msg.text });
    }
  }
  messages.push({ role: "user", content: question });

  try {
    // First API call — may request tool use
    let res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: systemPrompt,
        messages,
        tools,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    let result = await res.json();

    // Handle tool use loop (max 1 round of tool calls)
    if (result.stop_reason === "tool_use") {
      const toolUseBlock = result.content?.find((b: { type: string }) => b.type === "tool_use");
      if (toolUseBlock && toolUseBlock.name === "query_hubspot") {
        const { from: qFrom, to: qTo } = toolUseBlock.input;
        const toolResult = await queryHubSpot(qFrom, qTo);

        // Send tool result back
        messages.push({ role: "assistant", content: result.content });
        messages.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: toolUseBlock.id, content: toolResult }],
        });

        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 600,
            system: systemPrompt,
            messages,
            tools,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return Response.json({ error: err }, { status: res.status });
        }

        result = await res.json();
      }
    }

    const textBlock = result.content?.find((b: { type: string }) => b.type === "text");
    return Response.json({ answer: textBlock?.text ?? "No answer." });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
