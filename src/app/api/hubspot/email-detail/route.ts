import { NextRequest } from "next/server";
import { HUBSPOT_API } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

interface WidgetBody {
  html?: string;
  value?: string;
  richText?: string;
  img?: { src?: string; alt?: string; width?: number; height?: number };
  link?: string | { url?: { href?: string } };
  alignment?: string;
  style?: Record<string, unknown>;
  text?: string;
  label?: string;
  button_text?: string;
  button?: { text?: string; url?: { href?: string } };
  url?: { href?: string };
  href?: string;
  divider_type?: string;
  // rich text widget uses:
  content?: string;
}

interface Widget {
  body?: WidgetBody;
  id?: string;
  label?: string;
  name?: string;
  type?: string;
  path?: string;
  order?: number;
}

interface FlexAreaColumn {
  id?: string;
  widgets?: string[];
  width?: number;
}

interface FlexAreaSection {
  id?: string;
  columns?: FlexAreaColumn[];
}

interface FlexArea {
  sections?: FlexAreaSection[];
}

interface EmailContent {
  widgets?: Record<string, Widget>;
  flexAreas?: Record<string, FlexArea>;
  templatePath?: string;
}

interface HubSpotEmailDraft {
  id: string;
  name?: string;
  subject?: string;
  state?: string;
  previewKey?: string;
  fromName?: string;
  from?: { fromName?: string; replyTo?: string };
  replyTo?: string;
  previewText?: string;
  publishDate?: string;
  updatedAt?: string;
  createdAt?: string;
  content?: EmailContent;
  activeDomain?: string;
}

function pickLinkHref(body: WidgetBody | undefined): string | null {
  if (!body) return null;
  if (typeof body.link === "string") return body.link;
  if (body.link && typeof body.link === "object" && body.link.url?.href) return body.link.url.href;
  if (body.url?.href) return body.url.href;
  if (body.href) return body.href;
  return null;
}

function renderWidget(w: Widget | undefined): string {
  if (!w) return "";
  const body = w.body ?? {};
  const bodyPath = (body as unknown as { path?: string }).path ?? "";
  const path = bodyPath || w.path || w.type || "";

  // Text widget with rendered html
  if (typeof body.html === "string" && body.html.trim().length > 0) {
    return body.html;
  }
  if (typeof body.richText === "string" && body.richText.trim().length > 0) {
    return body.richText;
  }
  if (typeof body.content === "string" && body.content.trim().length > 0) {
    return body.content;
  }

  // Image widget
  if (/image/i.test(path) && body.img?.src) {
    const alt = body.img.alt ?? "";
    const w2 = body.img.width;
    const h2 = body.img.height;
    const align = typeof body.alignment === "string" ? body.alignment : "center";
    const img = `<img src="${escapeAttr(body.img.src)}" alt="${escapeAttr(alt)}"${w2 ? ` width="${w2}"` : ""}${h2 ? ` height="${h2}"` : ""} style="max-width:100%;height:auto;display:inline-block;">`;
    const href = pickLinkHref(body);
    const linked = href ? `<a href="${escapeAttr(href)}">${img}</a>` : img;
    return `<div style="text-align:${align};padding:8px 0;">${linked}</div>`;
  }

  // Button / CTA widget
  if (/button|cta/i.test(path)) {
    const text = body.button_text ?? body.button?.text ?? body.text ?? body.label ?? "Open";
    const href = body.button?.url?.href ?? pickLinkHref(body) ?? "#";
    return `<div style="text-align:center;padding:12px 0;"><a href="${escapeAttr(href)}" style="display:inline-block;padding:12px 24px;background:#0071E3;color:white;border-radius:6px;text-decoration:none;font-weight:500;">${escapeText(text)}</a></div>`;
  }

  // Divider
  if (/divider|spacer/i.test(path)) {
    return `<hr style="border:none;border-top:1px solid #E5E5EA;margin:16px 0;">`;
  }

  // Plain text fallback
  if (typeof body.text === "string" && body.text.trim().length > 0) {
    return `<p>${escapeText(body.text)}</p>`;
  }

  return "";
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function assembleHtml(content: EmailContent | undefined): string {
  if (!content?.widgets) return "";
  const widgets = content.widgets;
  const used = new Set<string>();
  const sectionHtmls: string[] = [];

  const flexAreas = content.flexAreas ?? {};
  for (const areaKey of Object.keys(flexAreas)) {
    const sections = flexAreas[areaKey]?.sections ?? [];
    for (const section of sections) {
      const cols = section.columns ?? [];
      const totalWidth = cols.reduce((sum, c) => sum + (c.width ?? 12), 0) || 12;
      const cellHtmls: string[] = [];
      for (const col of cols) {
        const widgetsInCol: string[] = [];
        for (const wid of col.widgets ?? []) {
          if (used.has(wid)) continue;
          used.add(wid);
          const html = renderWidget(widgets[wid]);
          if (html) widgetsInCol.push(html);
        }
        if (widgetsInCol.length === 0) continue;
        const pct = Math.round(((col.width ?? 12) / totalWidth) * 100);
        cellHtmls.push(`<td valign="top" style="width:${pct}%;padding:8px;vertical-align:top;">${widgetsInCol.join("\n")}</td>`);
      }
      if (cellHtmls.length > 0) {
        sectionHtmls.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>${cellHtmls.join("")}</tr></table>`);
      }
    }
  }

  // Fallback: widgets not referenced from any flexArea section
  const orphans: string[] = [];
  for (const k of Object.keys(widgets)) {
    if (used.has(k)) continue;
    const html = renderWidget(widgets[k]);
    if (html) orphans.push(html);
  }
  if (orphans.length > 0) sectionHtmls.push(orphans.join("\n"));

  if (sectionHtmls.length === 0) return "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1D1D1F;padding:0;margin:0;line-height:1.5;background:#F5F5F7;}
    .email-wrap{max-width:720px;margin:0 auto;background:white;padding:20px;}
    img{max-width:100%;height:auto;}
    a{color:#0071E3;}
    h1,h2,h3,h4{margin:12px 0;}
    p{margin:8px 0;}
  </style></head><body><div class="email-wrap">${sectionHtmls.join("\n")}</div></body></html>`;
}

let cachedPortalId: string | null = null;
let cachedUiDomain: string | null = null;

async function ensureHubInfo(token: string): Promise<{ portalId: string | null; uiDomain: string }> {
  if (cachedPortalId && cachedUiDomain) return { portalId: cachedPortalId, uiDomain: cachedUiDomain };
  try {
    const res = await fetch(`${HUBSPOT_API}/account-info/v3/details`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { portalId: null, uiDomain: "app.hubspot.com" };
    const data = (await res.json()) as { portalId?: number; uiDomain?: string };
    cachedPortalId = data.portalId ? String(data.portalId) : null;
    cachedUiDomain = data.uiDomain ?? "app.hubspot.com";
    return { portalId: cachedPortalId, uiDomain: cachedUiDomain };
  } catch {
    return { portalId: null, uiDomain: "app.hubspot.com" };
  }
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const id = request.nextUrl.searchParams.get("id");
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const key = cacheKey("email-detail-v5", { id, debug: debug ? "1" : undefined });
  const data = await cached(key, debug ? 0 : TTL.LONG, async () => {
    const headers = { Authorization: `Bearer ${token}` };

    const draftRes = await fetch(`${HUBSPOT_API}/marketing/v3/emails/${encodeURIComponent(id)}/draft`, {
      cache: "no-store",
      headers,
    });
    let detail: HubSpotEmailDraft | null = null;
    if (draftRes.ok) {
      detail = (await draftRes.json()) as HubSpotEmailDraft;
    } else {
      const base = await fetch(`${HUBSPOT_API}/marketing/v3/emails/${encodeURIComponent(id)}`, {
        cache: "no-store",
        headers,
      });
      if (!base.ok) {
        const body = await base.text().catch(() => "");
        return { error: `HubSpot ${base.status}: ${body.slice(0, 300)}` };
      }
      detail = (await base.json()) as HubSpotEmailDraft;
    }

    const html = assembleHtml(detail.content);
    const widgetCount = Object.keys(detail.content?.widgets ?? {}).length;
    console.error(`[email-detail] id=${id} name="${detail.name}" widgets=${widgetCount} htmlLength=${html.length} previewKey=${detail.previewKey ? "yes" : "no"}`);

    const { portalId, uiDomain } = await ensureHubInfo(token);
    const fromName = detail.from?.fromName ?? detail.fromName ?? "";
    const replyTo = detail.from?.replyTo ?? detail.replyTo ?? "";

    const editUrl = portalId ? `https://${uiDomain}/email/${portalId}/edit/${id}/content` : null;

    let previewUrl: string | null = null;
    if (detail.previewKey && detail.activeDomain) {
      previewUrl = `https://${detail.activeDomain}/_hcms/preview/email/${id}?preview_key=${encodeURIComponent(detail.previewKey)}&cached=false`;
    }

    return {
      id: detail.id ?? id,
      name: detail.name ?? "",
      subject: detail.subject ?? "",
      state: detail.state ?? "",
      fromName,
      replyTo,
      previewText: detail.previewText ?? "",
      publishDate: detail.publishDate ?? null,
      updatedAt: detail.updatedAt ?? null,
      createdAt: detail.createdAt ?? null,
      html,
      widgetCount,
      portalId,
      uiDomain,
      previewKey: detail.previewKey ?? null,
      editUrl,
      previewUrl,
    };
  });

  const hasError = typeof data === "object" && data !== null && "error" in data;
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": hasError ? "no-store" : "private, max-age=900",
    },
  });
}
