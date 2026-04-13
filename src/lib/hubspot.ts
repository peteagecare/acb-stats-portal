/**
 * Shared HubSpot utilities — single source of truth for all API routes.
 *
 * Exports: londonDateToUtcMs, hubspotFetch, hubspotSearch, constants.
 */

export const HUBSPOT_API = "https://api.hubapi.com";

const TZ = "Europe/London";

// ---------------------------------------------------------------------------
// Timezone helper
// ---------------------------------------------------------------------------

/**
 * Convert a date string (YYYY-MM-DD) + time to UTC milliseconds,
 * interpreted in Europe/London timezone. Correctly handles GMT/BST
 * boundaries regardless of server timezone.
 */
export function londonDateToUtcMs(dateStr: string, time: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });

  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const parts = formatter.formatToParts(new Date(utcGuess));
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "+00";
  const offsetMatch = tzPart.match(/([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
  return Date.UTC(y, m - 1, d, hh - offsetHours, mm, ss);
}

// ---------------------------------------------------------------------------
// Concurrency limiter — keeps total in-flight HubSpot requests ≤ MAX_CONCURRENT
// so parallel routes don't blow past HubSpot's 100 req/10s rate limit.
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 8;
let inflight = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (inflight < MAX_CONCURRENT) {
    inflight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    queue.push(() => { inflight++; resolve(); });
  });
}

function release(): void {
  inflight--;
  if (queue.length > 0) {
    const next = queue.shift()!;
    next();
  }
}

// ---------------------------------------------------------------------------
// Fetch helpers with retry
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;

/**
 * Generic HubSpot API call with concurrency limiting, 429 retry + backoff.
 * `pathOrUrl` can be a path like "/crm/v3/..." (prefixed with HUBSPOT_API)
 * or a full URL.
 */
export async function hubspotFetch(
  pathOrUrl: string,
  token: string,
  options?: RequestInit,
): Promise<Record<string, unknown>> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${HUBSPOT_API}${pathOrUrl}`;

  await acquire();
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
      if (res.status === 429 && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        throw new Error(`HubSpot API error: ${res.status} ${await res.text()}`);
      }
      return res.json();
    }
    throw new Error("HubSpot request failed after retries");
  } finally {
    release();
  }
}

/**
 * HubSpot contacts/search with retry. Returns typed paging structure.
 */
export async function hubspotSearch(
  token: string,
  body: object,
): Promise<{
  total: number;
  results: { id: string; properties: Record<string, string | null> }[];
  paging?: { next?: { after: string } };
}> {
  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data as ReturnType<typeof hubspotSearch> extends Promise<infer T> ? T : never;
}

/**
 * Fetch a HubSpot property definition and return a value→label map.
 * Used by routes that need to resolve property option labels.
 */
export async function fetchPropertyLabels(
  token: string,
  propertyName: string,
): Promise<Record<string, string>> {
  try {
    const data = await hubspotFetch(
      `/crm/v3/properties/contacts/${propertyName}`,
      token,
    );
    const map: Record<string, string> = {};
    for (const opt of (data.options as { value: string; label: string }[]) ?? []) {
      if (opt?.value) map[opt.value] = opt.label ?? opt.value;
    }
    return map;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Conversion actions that classify a contact as a Prospect. */
export const PROSPECT_ACTIONS = [
  "Brochure Download Form",
  "Flipbook Form",
  "VAT Exempt Checker",
  "Pricing Guide",
  "Physical Brochure Request",
  "Newsletter Sign Up",
];

/** Conversion actions that classify a contact as a Lead. */
export const LEAD_ACTIONS = [
  "Brochure - Call Me",
  "Request A Callback Form",
  "Contact Form",
  "Free Home Design Form",
  "Phone Call",
  "Walk In Bath Form",
  "Direct Email",
  "Brochure - Home Visit",
  "Pricing Guide Home Visit",
];

/** Pre-built Set versions for routes that check membership. */
export const PROSPECT_ACTIONS_SET = new Set(PROSPECT_ACTIONS);
export const LEAD_ACTIONS_SET = new Set(LEAD_ACTIONS);

/** Map original_lead_source values to reporting categories. */
export const SOURCE_CATEGORIES: Record<string, string> = {
  "Google Ads": "PPC",
  "Bing Ads": "PPC",
  "Facebook Ads": "PPC",
  "Organic Search": "SEO",
  "AI": "SEO",
  "Directory Referral": "SEO",
  "Organic Social": "Content",
  "Organic YouTube": "Content",
};

export function getSourceCategory(value: string): string {
  return SOURCE_CATEGORIES[value] ?? "Other";
}
