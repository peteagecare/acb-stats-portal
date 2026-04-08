/**
 * Lifecycle stages whose contacts should be excluded from every dashboard
 * metric. "Suppliers & Muppets" (internal id 158047184) is the bucket Pete
 * uses for vendors, junk, and people we don't want polluting reports.
 */
export const EXCLUDED_LIFECYCLE_STAGES = ["158047184"];

/**
 * HubSpot search filter to drop contacts in any excluded lifecycle stage.
 * Add this to every `filters: [...]` array in a contacts/search request.
 *
 * NOT_IN with a single-element list is used so the same shape works whether
 * we add more excluded stages later. NOT_IN does not match contacts whose
 * property is unset, but in practice every active contact has a stage; if
 * that ever changes we can switch to a multi-filterGroup OR.
 */
export const LIFECYCLE_EXCLUSION_FILTER: Record<string, unknown> = {
  propertyName: "lifecyclestage",
  operator: "NOT_IN",
  values: EXCLUDED_LIFECYCLE_STAGES,
};
