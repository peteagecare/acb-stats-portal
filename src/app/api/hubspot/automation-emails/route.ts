import { NextRequest } from "next/server";
import { HUBSPOT_API } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

interface FlowAction {
  actionId?: string;
  type?: string;
  actionTypeId?: string;
  fields?: Record<string, unknown>;
  connection?: { nextActionId?: string };
}

interface Flow {
  id: string;
  name: string;
  startActionId?: string;
  actions?: FlowAction[];
}

interface EmailStats {
  id: string;
  name: string;
  order: number;
  subject?: string;
  sent?: number;
  opens?: number;
  clicks?: number;
  openRate?: number;
  clickRate?: number;
  clickThroughRate?: number;
}

async function hsGet<T>(url: string, token: string): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body: body.slice(0, 400) };
  }
  return { ok: true, data: (await res.json()) as T };
}

function extractEmailIds(flow: Flow): string[] {
  const actions = flow.actions ?? [];
  const byId = new Map<string, FlowAction>();
  for (const a of actions) if (a.actionId) byId.set(a.actionId, a);

  const getEmailId = (a: FlowAction): string | null => {
    if (a.actionTypeId !== "0-4") return null;
    const f = a.fields ?? {};
    const raw = f.content_id ?? f.contentId ?? f.emailId ?? f.email_id ?? f.automatedEmailId ?? f.staticEmailId;
    return raw == null ? null : String(raw);
  };

  const ordered: string[] = [];
  const collected = new Set<string>();
  const seen = new Set<string>();
  let cursor = flow.startActionId;
  while (cursor && byId.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    const a = byId.get(cursor)!;
    const emailId = getEmailId(a);
    if (emailId && !collected.has(emailId)) {
      ordered.push(emailId);
      collected.add(emailId);
    }
    cursor = a.connection?.nextActionId;
  }

  for (const a of actions) {
    const emailId = getEmailId(a);
    if (emailId && !collected.has(emailId)) {
      ordered.push(emailId);
      collected.add(emailId);
    }
  }
  return ordered;
}

function toUtcIso(dateStr: string, endOfDay: boolean): string {
  const d = new Date(`${dateStr}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  return d.toISOString();
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const nameQuery = searchParams.get("name");
  const idParam = searchParams.get("id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!nameQuery && !idParam) {
    return Response.json({ error: "Provide 'name' or 'id' query param" }, { status: 400 });
  }

  const key = cacheKey("automation-emails-v5", {
    name: nameQuery ?? undefined,
    id: idParam ?? undefined,
    from: from ?? undefined,
    to: to ?? undefined,
  });
  const data = await cached(key, TTL.LONG, async () => {
    let flowId = idParam;
    let flowName: string | undefined;

    if (!flowId && nameQuery) {
      const list = await hsGet<{ results: Flow[] }>(`${HUBSPOT_API}/automation/v4/flows?limit=500`, token);
      if (!list.ok) {
        return { error: `Failed to list workflows: ${list.status} ${list.body}`, emails: [] };
      }
      const needle = nameQuery.toLowerCase();
      const match = list.data.results?.find((f) => f.name?.toLowerCase().includes(needle));
      if (!match) {
        return { error: `No workflow found matching "${nameQuery}"`, emails: [] };
      }
      flowId = match.id;
      flowName = match.name;
    }

    if (!flowId) return { error: "Could not resolve workflow id", emails: [] };

    const flowRes = await hsGet<Flow>(`${HUBSPOT_API}/automation/v4/flows/${flowId}`, token);
    if (!flowRes.ok) {
      return { error: `Failed to fetch workflow ${flowId}: ${flowRes.status} ${flowRes.body}`, emails: [] };
    }
    const flow = flowRes.data;
    flowName = flowName ?? flow.name;

    const emailIds = extractEmailIds(flow);

    const useDateRange = !!(from && to);
    const startTs = from ? toUtcIso(from, false) : null;
    const endTs = to ? toUtcIso(to, true) : null;

    const emails: EmailStats[] = [];
    for (let i = 0; i < emailIds.length; i++) {
      const eid = emailIds[i];

      const detailUrl = useDateRange
        ? `${HUBSPOT_API}/marketing/v3/emails/${eid}`
        : `${HUBSPOT_API}/marketing/v3/emails/${eid}?includeStats=true`;

      const detailRes = await hsGet<{
        id: string;
        name?: string;
        subject?: string;
        stats?: {
          counters?: { sent?: number; open?: number; click?: number; delivered?: number };
          ratios?: { openratio?: number; clickratio?: number; clickthroughratio?: number };
        };
      }>(detailUrl, token);

      if (!detailRes.ok) {
        emails.push({ id: eid, name: `Email ${i + 1} (${detailRes.status})`, order: i + 1 });
        continue;
      }

      const emailDetail = detailRes.data;
      let counters = emailDetail.stats?.counters ?? {};
      let ratios = emailDetail.stats?.ratios ?? {};

      if (useDateRange) {
        const statsRes = await hsGet<{
          aggregate?: {
            counters?: { sent?: number; open?: number; click?: number; delivered?: number };
            ratios?: { openratio?: number; clickratio?: number; clickthroughratio?: number };
          };
        }>(
          `${HUBSPOT_API}/marketing/v3/emails/statistics/list?emailIds=${eid}&startTimestamp=${encodeURIComponent(startTs!)}&endTimestamp=${encodeURIComponent(endTs!)}`,
          token
        );
        if (statsRes.ok) {
          counters = statsRes.data.aggregate?.counters ?? {};
          const r = statsRes.data.aggregate?.ratios ?? {};
          const delivered = counters.delivered ?? 0;
          const opens = counters.open ?? 0;
          const clicks = counters.click ?? 0;
          ratios = {
            openratio: r.openratio ?? (delivered > 0 ? (opens / delivered) * 100 : 0),
            clickratio: r.clickratio ?? (delivered > 0 ? (clicks / delivered) * 100 : 0),
            clickthroughratio: r.clickthroughratio ?? (opens > 0 ? (clicks / opens) * 100 : 0),
          };
        }
      }

      emails.push({
        id: eid,
        order: i + 1,
        name: emailDetail.name ?? `Email ${i + 1}`,
        subject: emailDetail.subject,
        sent: counters.sent,
        opens: counters.open,
        clicks: counters.click,
        openRate: ratios.openratio,
        clickRate: ratios.clickratio,
        clickThroughRate: ratios.clickthroughratio,
      });

      const callsPerEmail = useDateRange ? 2 : 1;
      if (i < emailIds.length - 1 && ((i + 1) * callsPerEmail) % 5 === 0) {
        await new Promise((res) => setTimeout(res, 300));
      }
    }

    return { workflow: { id: flowId, name: flowName }, emails };
  });

  const hasError = typeof data === "object" && data !== null && "error" in data;
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": hasError ? "no-store" : "private, max-age=900",
    },
  });
}
