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

  const { question, dashboardData } = await request.json();

  const systemPrompt = `You are a marketing data analyst for Age Care Bathrooms, a UK company selling walk-in baths to people aged 55+. You have access to their live marketing dashboard data. Answer questions concisely using actual numbers from the data. Keep answers to 2-3 sentences max. Use £ for currency. If you don't have the data to answer, say so.

CURRENT DASHBOARD DATA:
- Website Visitors: ${dashboardData.visitors ?? "N/A"}
- Contacts: ${dashboardData.contacts}
- Prospects: ${dashboardData.prospects}
- Leads: ${dashboardData.leads}
- Home Visits: ${dashboardData.homeVisits}
- Won Jobs: ${dashboardData.wonJobs} (value: £${dashboardData.wonValue ?? 0})
- Unattributed contacts: ${dashboardData.unattributedContacts}
- Direct bookings (booked a visit without filling out a lead form): ${dashboardData.organicLeads}
- Previous period contacts: ${dashboardData.prevContacts ?? "N/A"}
- Previous period leads: ${dashboardData.prevLeads ?? "N/A"}
- Sources: ${dashboardData.sources?.map((s: { label: string; count: number }) => `${s.label}: ${s.count}`).join(", ") ?? "N/A"}`;

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
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: question }],
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
