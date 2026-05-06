// Cookie name is per-flipbook so submitting on one flipbook doesn't unlock
// another. Value is a random opaque ID that maps to a row in flipbook_leads.

export function leadCookieName(flipbookId: string): string {
  return `flb_lead_${flipbookId}`;
}

export const LEAD_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
