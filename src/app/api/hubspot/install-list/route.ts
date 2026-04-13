import { NextRequest } from "next/server";
import { HUBSPOT_API } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

async function dealsSearch(token: string, body: object): Promise<{
  results: { id: string; properties: Record<string, string | null> }[];
  paging?: { next?: { after: string } };
}> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/deals/search`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(`HubSpot deals/search failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }
  throw new Error("HubSpot deals/search failed after retries");
}

/**
 * GET /api/hubspot/install-list?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns deals with installation_date in the date range (excludes lost deals).
 */
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

  const key = cacheKey("install-list", { from, to });
  const data = await cached(key, TTL.SHORT, async () => {
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    const fromMs = Date.UTC(fy, fm - 1, fd, 0, 0, 0);
    const toMs = Date.UTC(ty, tm - 1, td, 23, 59, 59, 999);

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 20;
    const allDeals: {
      id: string;
      name: string;
      installDate: string;
      amount: string;
      stage: string;
    }[] = [];

    do {
      const body: Record<string, unknown> = {
        filterGroups: [{
          filters: [
            { propertyName: "installation_date", operator: "GTE", value: fromMs.toString() },
            { propertyName: "installation_date", operator: "LTE", value: toMs.toString() },
            { propertyName: "dealstage", operator: "NEQ", value: "closedlost" },
          ],
        }],
        properties: [
          "dealname", "installation_date", "amount", "dealstage",
        ],
        limit: 100,
        sorts: [{ propertyName: "installation_date", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const result = await dealsSearch(token, body);
      for (const d of result.results ?? []) {
        allDeals.push({
          id: d.id,
          name: d.properties?.dealname ?? "Unnamed deal",
          installDate: d.properties?.installation_date ?? "",
          amount: d.properties?.amount ?? "",
          stage: d.properties?.dealstage ?? "",
        });
      }

      after = result.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    return { deals: allDeals };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
