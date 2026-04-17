import { NextRequest } from "next/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const limit = rateLimit(`ai-summary:${clientKey(request)}`, 10, 60_000);
  if (!limit.ok) {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });

  const { metric, from, to, timelineData, dailyBreakdown, totalContacts, totalProspects, totalLeads, totalVisits } = await request.json();

  // Build a concise data summary for Claude
  const lines: string[] = [];
  lines.push(`Period: ${from} to ${to}`);
  lines.push(`Active metric: ${metric}`);
  lines.push(`Totals — Contacts: ${totalContacts ?? "?"}, Prospects: ${totalProspects ?? "?"}, Leads: ${totalLeads ?? "?"}, Home Visits: ${totalVisits ?? "?"}`);

  if (timelineData?.length) {
    const sorted = [...timelineData].sort((a: { count: number }, b: { count: number }) => b.count - a.count);
    const best = sorted[0];
    const worst = sorted.filter((d: { count: number }) => d.count >= 0).pop();
    const zero = timelineData.filter((d: { count: number }) => d.count === 0);
    lines.push(`Daily data points: ${timelineData.length}`);
    lines.push(`Best day: ${best.label} (${best.count})`);
    if (worst) lines.push(`Worst day: ${worst.label} (${worst.count})`);
    lines.push(`Days with zero: ${zero.length}`);

    // Weekend vs weekday performance
    let weekdayTotal = 0, weekdayCount = 0, weekendTotal = 0, weekendCount = 0;
    for (const d of timelineData) {
      const dow = new Date(d.label + "T12:00:00").getDay();
      if (dow === 0 || dow === 6) { weekendTotal += d.count; weekendCount++; }
      else { weekdayTotal += d.count; weekdayCount++; }
    }
    if (weekdayCount > 0) lines.push(`Weekday avg: ${(weekdayTotal / weekdayCount).toFixed(1)}`);
    if (weekendCount > 0) lines.push(`Weekend avg: ${(weekendTotal / weekendCount).toFixed(1)}`);
  }

  // Aggregate source and action totals across all days
  if (dailyBreakdown && typeof dailyBreakdown === "object") {
    const sourceTotals: Record<string, number> = {};
    const actionTotals: Record<string, number> = {};

    for (const day of Object.values(dailyBreakdown) as { sources: { label: string; count: number }[]; actions: { label: string; count: number }[] }[]) {
      for (const s of day.sources ?? []) sourceTotals[s.label] = (sourceTotals[s.label] ?? 0) + s.count;
      for (const a of day.actions ?? []) actionTotals[a.label] = (actionTotals[a.label] ?? 0) + a.count;
    }

    const topSources = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1]);
    const topActions = Object.entries(actionTotals).sort((a, b) => b[1] - a[1]);

    if (topSources.length) lines.push(`Lead sources (total): ${topSources.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    if (topActions.length) lines.push(`Conversion actions (total): ${topActions.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  }

  const systemPrompt = `You are a sharp marketing analyst for Age Care Bathrooms (UK walk-in bath company, customers aged 55+). Generate 4-5 punchy insight bullets from the data below. Today is ${new Date().toISOString().split("T")[0]}.

RULES:
- Return exactly 5 insights, one per line, no bullet characters or numbering
- Each insight must be a single short sentence (under 15 words) with a specific number
- Include: top lead source, top conversion action, best day, worst day, weekend vs weekday
- Use plain language, no jargon, no markdown, no emojis
- Use £ for money, format numbers with commas
- Write in second person ("your") as if briefing the business owner
- Each line should be self-contained and make sense on its own`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: lines.join("\n") }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const result = await res.json();
    const text = result.content?.[0]?.text ?? "";
    return Response.json({ summary: text });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
