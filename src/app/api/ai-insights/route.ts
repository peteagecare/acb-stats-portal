import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const data = await request.json();

  const prompt = `You are a senior marketing analyst for Age Care Bathrooms, a UK company that sells walk-in baths and accessible bathrooms to people aged 55+. Analyse this marketing data and give exactly 5 actionable insights to improve lead generation and home visit bookings.

Here is the current dashboard data for the selected period:

FUNNEL METRICS:
- Website Visitors: ${data.visitors ?? "N/A"}
- Contacts (people who filled a form): ${data.contacts}
- Prospects (low-intent actions like brochure downloads): ${data.prospects}
- Leads (high-intent actions like callback requests, contact forms): ${data.leads}
- Home Visits booked: ${data.homeVisits}
- Won Jobs: ${data.wonJobs} (value: £${data.wonValue ?? 0})
- Contacts without a source attributed: ${data.unattributedContacts}
- Prospects who skipped lead stage and booked visits directly: ${data.organicLeads}

CONVERSION RATES:
- Visitor → Contact: ${data.visitors && data.contacts ? ((data.contacts / data.visitors) * 100).toFixed(1) : "N/A"}%
- Contact → Prospect: ${data.contacts ? ((data.prospects / data.contacts) * 100).toFixed(1) : "N/A"}%
- Contact → Lead: ${data.contacts ? ((data.leads / data.contacts) * 100).toFixed(1) : "N/A"}%
- Lead → Home Visit: ${data.leads ? ((data.homeVisits / data.leads) * 100).toFixed(1) : "N/A"}%
- Home Visit → Won: ${data.homeVisits ? ((data.wonJobs / data.homeVisits) * 100).toFixed(1) : "N/A"}%

CONTACTS BY SOURCE:
${data.sources?.map((s: { label: string; count: number }) => `- ${s.label}: ${s.count}`).join("\n") ?? "N/A"}

CONVERSION ACTIONS BREAKDOWN:
Prospect actions: ${data.prospectActions?.map((a: { label: string; count: number }) => `${a.label}: ${a.count}`).join(", ") ?? "N/A"}
Lead actions: ${data.leadActions?.map((a: { label: string; count: number }) => `${a.label}: ${a.count}`).join(", ") ?? "N/A"}

PREVIOUS PERIOD COMPARISON:
- Contacts: ${data.prevContacts ?? "N/A"} → ${data.contacts} (${data.prevContacts ? ((data.contacts - data.prevContacts) / data.prevContacts * 100).toFixed(0) : "N/A"}% change)
- Leads: ${data.prevLeads ?? "N/A"} → ${data.leads} (${data.prevLeads ? ((data.leads - data.prevLeads) / data.prevLeads * 100).toFixed(0) : "N/A"}% change)

BEST PERFORMING DAY: ${data.bestDay ?? "N/A"}

${data.rejectedInsights && data.rejectedInsights.length > 0 ? `PREVIOUSLY REJECTED INSIGHTS (the user said these were NOT relevant — do NOT suggest similar things):
${data.rejectedInsights.map((r: string) => `- ${r}`).join("\n")}
` : ""}${data.acceptedInsights && data.acceptedInsights.length > 0 ? `PREVIOUSLY ACCEPTED INSIGHTS (the user liked these — suggest more in this direction):
${data.acceptedInsights.map((r: string) => `- ${r}`).join("\n")}
` : ""}
Rules:
- Be specific and actionable, not generic
- Reference actual numbers from the data
- Focus on things they can change THIS WEEK
- Consider their target audience is 55+ homeowners
- Each insight should be 1-2 sentences max
- Use plain English, no jargon
- Format as a numbered list
- If something looks concerning (e.g. high prospects but low leads), flag it
- If something looks great, acknowledge it briefly`;

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
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const result = await res.json();
    const text = result.content?.[0]?.text ?? "No insights available.";

    return Response.json({ insights: text });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "AI error" },
      { status: 500 }
    );
  }
}
