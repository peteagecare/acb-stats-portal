import { EXCLUDED_LIFECYCLE_STAGES } from "@/lib/hubspot-exclusions";
import { hubspotFetch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

async function countByLifecycleStage(
  token: string,
  stage: string
): Promise<number> {
  const body = {
    filterGroups: [
      {
        filters: [
          { propertyName: "lifecyclestage", operator: "EQ", value: stage },
        ],
      },
    ],
    properties: ["lifecyclestage"],
    limit: 1,
  };

  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return (data as { total?: number }).total ?? 0;
}

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const key = cacheKey("lifecycle-stages", {});
  const data = await cached(key, TTL.LONG, async () => {
    // Fetch lifecycle stage property to get all options dynamically
    const propData = await hubspotFetch(
      "/crm/v3/properties/contacts/lifecyclestage",
      token
    );

    const allOptions: { value: string; label: string; displayOrder: number }[] =
      (propData as { options?: { value: string; label: string; displayOrder: number }[] }).options ?? [];
    // Drop excluded stages (e.g. "Suppliers & Muppets") from the breakdown entirely
    const options = allOptions.filter((o) => !EXCLUDED_LIFECYCLE_STAGES.includes(o.value));

    // Count contacts for each stage, batched 4 at a time
    const BATCH_SIZE = 4;
    const counts: number[] = [];

    for (let i = 0; i < options.length; i += BATCH_SIZE) {
      const batch = options.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((opt) => countByLifecycleStage(token, opt.value))
      );
      counts.push(...results);
      if (i + BATCH_SIZE < options.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const stages = options
      .map((opt, i) => ({
        label: opt.label,
        value: opt.value,
        count: counts[i],
        order: opt.displayOrder,
      }))
      .sort((a, b) => a.order - b.order);

    return { stages };
  });

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
}
