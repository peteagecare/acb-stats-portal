import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, PROSPECT_ACTIONS_SET, LEAD_ACTIONS_SET, getSourceCategory } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Check whether a contact matches the requested stage.
 * Matches the dashboard KPI card logic:
 * - Contacts: all contacts with a conversion_action
 * - Prospects: conversion_action is in PROSPECT_ACTIONS
 * - Leads: conversion_action is in LEAD_ACTIONS
 * - Home Visits: has date_that_initial_visit_booked_is_set_to_yes
 * - Won Jobs: has won_date
 */
function matchesStage(stage: string, action: string, visitBooked: boolean, won: boolean): boolean {
  switch (stage.toLowerCase()) {
    case "contacts": return true;
    case "prospects": return PROSPECT_ACTIONS_SET.has(action);
    case "leads": return LEAD_ACTIONS_SET.has(action);
    case "home visits": return visitBooked;
    case "won jobs": return won;
    default: return false;
  }
}

/**
 * Display label for the contact's current highest stage.
 */
function classifyStage(action: string, visitBooked: boolean, won: boolean): string {
  if (won) return "Won Job";
  if (visitBooked) return "Home Visit";
  if (LEAD_ACTIONS_SET.has(action)) return "Lead";
  if (PROSPECT_ACTIONS_SET.has(action)) return "Prospect";
  return "Contact";
}

/**
 * GET /api/hubspot/contact-list?from=YYYY-MM-DD&to=YYYY-MM-DD&stage=Contacts|Prospects|Leads|Home+Visits|Won+Jobs
 *
 * Returns all contacts created in the date range that match the given funnel
 * stage, with name, email, phone, source, action, stage, and HubSpot contact ID.
 */
export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const stage = searchParams.get("stage"); // "Contacts", "Prospects", "Leads", "Home Visits", "Won Jobs"
  const sourceCategory = searchParams.get("sourceCategory"); // optional: "PPC", "SEO", "Content", "Other"

  if (!from || !to || !stage) {
    return Response.json({ error: "Missing required params: from, to, stage" }, { status: 400 });
  }

  const key = cacheKey("contact-list", { from, to, stage, sourceCategory: sourceCategory ?? undefined });
  const data = await cached(key, TTL.SHORT, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 80;
    const allContacts: {
      id: string;
      name: string;
      email: string;
      phone: string;
      source: string;
      action: string;
      stage: string;
      created: string;
      lastActivity: string;
      daysSinceActivity: number | null;
    }[] = [];

    // Choose date filter based on stage to match dashboard KPI logic:
    // - Contacts/Prospects/Leads: filter by createdate (contacts created in period)
    // - Home Visits: filter by date_that_initial_visit_booked_is_set_to_yes (visits booked in period)
    // - Won Jobs: filter by first_deal_created_date + won lifecycle stages
    const stageNorm = stage.toLowerCase();
    const WON_STAGES = ["151694551", "151694559"]; // Won-Waiting, Completed

    let dateFilterProp = "createdate";
    if (stageNorm === "home visits") dateFilterProp = "date_that_initial_visit_booked_is_set_to_yes";
    else if (stageNorm === "won jobs") dateFilterProp = "first_deal_created_date";

    do {
      const filters: Record<string, unknown>[] = [
        { propertyName: dateFilterProp, operator: "GTE", value: fromMs.toString() },
        { propertyName: dateFilterProp, operator: "LTE", value: toMs.toString() },
        LIFECYCLE_EXCLUSION_FILTER,
      ];
      // For Contacts/Prospects/Leads, require a conversion_action
      if (stageNorm !== "home visits" && stageNorm !== "won jobs") {
        filters.push({ propertyName: "conversion_action", operator: "HAS_PROPERTY" });
      }
      // For Won Jobs, filter by lifecycle stage
      if (stageNorm === "won jobs") {
        filters.push({ propertyName: "lifecyclestage", operator: "IN", values: WON_STAGES });
      }

      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              ...filters,
            ],
          },
        ],
        properties: [
          "firstname",
          "lastname",
          "email",
          "phone",
          "mobilephone",
          "createdate",
          "conversion_action",
          "original_lead_source",
          "date_that_initial_visit_booked_is_set_to_yes",
          "won_date",
          "first_deal_created_date",
          "lifecyclestage",
          "notes_last_updated",
          "hs_last_sales_activity_timestamp",
        ],
        limit: 100,
        sorts: [{ propertyName: dateFilterProp, direction: "DESCENDING" }],
      };
      if (after) body.after = after;

      const result = await hubspotSearch(token, body);

      for (const c of result.results ?? []) {
        const action = c.properties?.conversion_action ?? "";
        const visitBooked = !!c.properties?.date_that_initial_visit_booked_is_set_to_yes;
        const won = !!c.properties?.won_date;

        // For Home Visits and Won Jobs, the HubSpot query already filters correctly.
        // For Contacts/Prospects/Leads, apply client-side filter to match dashboard logic.
        if (stageNorm !== "home visits" && stageNorm !== "won jobs") {
          if (!matchesStage(stage, action, visitBooked, won)) continue;
        }
        const contactStage = classifyStage(action, visitBooked, won);

        // Filter by source category if specified
        const contactSource = c.properties?.original_lead_source ?? "";
        if (sourceCategory) {
          const cat = getSourceCategory(contactSource);
          if (cat !== sourceCategory) continue;
        }

        const phone = c.properties?.phone || c.properties?.mobilephone || "";
        const lastActivity = c.properties?.hs_last_sales_activity_timestamp || c.properties?.notes_last_updated || "";
        let daysSinceActivity: number | null = null;
        if (lastActivity) {
          const actDate = new Date(lastActivity);
          const now = new Date();
          daysSinceActivity = Math.floor((now.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        allContacts.push({
          id: c.id,
          name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(" ") || "Unknown",
          email: c.properties?.email ?? "",
          phone,
          source: c.properties?.original_lead_source ?? "",
          action,
          stage: contactStage,
          created: c.properties?.createdate ?? "",
          lastActivity,
          daysSinceActivity,
        });
      }

      after = result.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    return { contacts: allContacts };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
