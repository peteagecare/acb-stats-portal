import { NextRequest } from "next/server";
import { HUBSPOT_API } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

interface HubSpotEmail {
  id: string;
  name?: string;
  subject?: string;
  state?: string;
  type?: string;
  publishDate?: string;
  updatedAt?: string;
  createdAt?: string;
  isPublished?: boolean;
  archived?: boolean;
}

interface ListResponse {
  results: HubSpotEmail[];
  paging?: { next?: { after?: string } };
}

export async function GET(_request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const key = cacheKey("emails-list-v6", {});
  const data = await cached(key, TTL.SHORT, async () => {
    const all: HubSpotEmail[] = [];
    let after: string | undefined;
    for (let i = 0; i < 20; i++) {
      const url = new URL(`${HUBSPOT_API}/marketing/v3/emails`);
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { error: `HubSpot ${res.status}: ${body.slice(0, 300)}`, emails: [] };
      }
      const page = (await res.json()) as ListResponse;
      all.push(...(page.results ?? []));
      after = page.paging?.next?.after;
      if (!after) break;
    }

    const SENT_STATES = new Set([
      "PUBLISHED",
      "PUBLISHED_OR_SCHEDULED",
      "PUBLISHED_AB",
      "PUBLISHED_AB_VARIANT",
      "SENT",
    ]);
    const AUTOMATION_TYPES = new Set(["AUTOMATED_EMAIL", "FOLLOWUP_EMAIL"]);

    const emails = all
      .filter((e) => !e.archived && e.state !== "ARCHIVED")
      .filter((e) => {
        const isSent = SENT_STATES.has(e.state ?? "");
        const isAutomation = AUTOMATION_TYPES.has(e.type ?? "");
        return !(isSent && !isAutomation);
      })
      .map((e) => ({
        id: e.id,
        name: e.name ?? "(unnamed)",
        subject: e.subject ?? "",
        state: e.state ?? "UNKNOWN",
        type: e.type ?? "",
        publishDate: e.publishDate ?? null,
        updatedAt: e.updatedAt ?? null,
        createdAt: e.createdAt ?? null,
        isPublished: e.isPublished ?? false,
      }))
      .sort((a, b) => {
        const aDate = a.updatedAt ?? a.createdAt ?? "";
        const bDate = b.updatedAt ?? b.createdAt ?? "";
        return bDate.localeCompare(aDate);
      });

    return { emails };
  });

  const hasError = typeof data === "object" && data !== null && "error" in data;
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": hasError ? "no-store" : "private, max-age=60",
    },
  });
}
