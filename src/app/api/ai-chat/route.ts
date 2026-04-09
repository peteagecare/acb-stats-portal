import { NextRequest } from "next/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

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

  sections.push(`PERIOD: ${d.dateFrom ?? "?"} to ${d.dateTo ?? "?"}`);

  sections.push(`KEY METRICS:
- Website Visitors: ${d.visitors ?? "N/A"}
- Contacts: ${d.contacts ?? "N/A"}
- Prospects: ${d.prospects ?? "N/A"}
- Leads: ${d.leads ?? "N/A"}
- Home Visits Booked: ${d.homeVisits ?? "N/A"}
- Won Jobs: ${d.wonJobs ?? "N/A"} (value: £${(d.wonValue ?? 0).toLocaleString()})
- Unattributed contacts: ${d.unattributedContacts ?? "N/A"}
- Direct bookings (no lead form): ${d.organicLeads ?? "N/A"}`);

  if (d.prevContacts != null || d.prevLeads != null) {
    sections.push(`PREVIOUS PERIOD COMPARISON:
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

  const systemPrompt = `You are a marketing data analyst for Age Care Bathrooms, a UK company selling walk-in baths and accessible bathrooms to people aged 55+. You have access to their live marketing dashboard data below.

RULES:
- Answer questions concisely using actual numbers from the data
- Use £ for currency, format numbers with commas
- If calculating percentages, show both the percentage and the raw numbers
- If you don't have the data to answer, say so honestly
- Be direct and specific — no filler or caveats
- Keep answers to 3-4 sentences max unless the question requires more detail
- When comparing sources, always include the conversion rates

${sections.join("\n\n")}`;

  // Build messages array with conversation history
  const messages: { role: string; content: string }[] = [];
  if (Array.isArray(history)) {
    for (const msg of history.slice(-6)) {
      messages.push({ role: msg.role === "ai" ? "assistant" : "user", content: msg.text });
    }
  }
  messages.push({ role: "user", content: question });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const result = await res.json();
    return Response.json({ answer: result.content?.[0]?.text ?? "No answer." });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
