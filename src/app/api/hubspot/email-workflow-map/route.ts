import { NextRequest } from "next/server";
import { hubspotFetch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

interface WorkflowListItem {
  id: number | string;
  name?: string;
  enabled?: boolean;
  type?: string;
}

interface WorkflowAction {
  type?: string;
  emailContentId?: number | string;
  acceptActions?: WorkflowAction[];
  rejectActions?: WorkflowAction[];
  // v4 / newer flow shape
  actionTypeId?: string;
  fields?: Record<string, unknown>;
}

interface WorkflowDetail {
  id: number | string;
  name?: string;
  enabled?: boolean;
  actions?: WorkflowAction[];
}

interface WorkflowRef {
  id: string;
  name: string;
  enabled: boolean;
}

function extractEmailIds(actions: WorkflowAction[] | undefined, out: Set<string>) {
  if (!actions) return;
  for (const a of actions) {
    if (a.type === "EMAIL" && a.emailContentId != null) {
      out.add(String(a.emailContentId));
    }
    // v4 flow style
    if (a.actionTypeId === "0-4" && a.fields) {
      const f = a.fields as Record<string, unknown>;
      const raw = f.content_id ?? f.contentId ?? f.emailId ?? f.email_id ?? f.automatedEmailId ?? f.staticEmailId;
      if (raw != null) out.add(String(raw));
    }
    extractEmailIds(a.acceptActions, out);
    extractEmailIds(a.rejectActions, out);
  }
}

export async function GET(_request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const key = cacheKey("email-workflow-map-v1", {});
  const data = await cached(key, TTL.LONG, async () => {
    let workflows: WorkflowListItem[] = [];
    try {
      const list = (await hubspotFetch(`/automation/v3/workflows?limit=200`, token)) as unknown as {
        workflows?: WorkflowListItem[];
      };
      workflows = list.workflows ?? [];
    } catch (e) {
      return { error: `Failed to list workflows: ${e instanceof Error ? e.message : String(e)}`, byEmailId: {} };
    }

    const byEmailId: Record<string, WorkflowRef[]> = {};

    const tasks = workflows.map(async (wf) => {
      try {
        const detail = (await hubspotFetch(`/automation/v3/workflows/${wf.id}`, token)) as unknown as WorkflowDetail;
        const ids = new Set<string>();
        extractEmailIds(detail.actions, ids);
        const ref: WorkflowRef = {
          id: String(wf.id),
          name: wf.name ?? detail.name ?? `Workflow ${wf.id}`,
          enabled: !!(wf.enabled ?? detail.enabled),
        };
        for (const emailId of ids) {
          if (!byEmailId[emailId]) byEmailId[emailId] = [];
          byEmailId[emailId].push(ref);
        }
      } catch {
        // Skip workflows we can't fetch — partial map still useful
      }
    });
    await Promise.all(tasks);

    return { byEmailId };
  });

  const hasError = typeof data === "object" && data !== null && "error" in data;
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": hasError ? "no-store" : "private, max-age=900",
    },
  });
}
