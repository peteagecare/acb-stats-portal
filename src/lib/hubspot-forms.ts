// HubSpot Forms API submission. The Forms endpoint takes only portalId +
// formGuid (no API key) so it's safe to call server-side per submission.
// Forms must be created in HubSpot's UI first; the formGuid identifies it.

const FORMS_ENDPOINT = "https://api.hsforms.com/submissions/v3/integration/submit";

export type HubspotFormField = { name: string; value: string };

export type HubspotFormResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitHubspotForm(
  portalId: string,
  formGuid: string,
  fields: HubspotFormField[],
  context?: { pageUri?: string; pageName?: string; ipAddress?: string },
): Promise<HubspotFormResult> {
  const body = {
    submittedAt: Date.now(),
    fields: fields.filter((f) => f.value.length > 0),
    context: context
      ? {
          pageUri: context.pageUri,
          pageName: context.pageName,
          ipAddress: context.ipAddress,
        }
      : undefined,
  };

  try {
    const res = await fetch(`${FORMS_ENDPOINT}/${portalId}/${formGuid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "submit failed",
    };
  }
}
