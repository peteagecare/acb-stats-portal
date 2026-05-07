import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationPrefs, notifications } from "@/db/schema";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { sendCalendarStatusEmail } from "@/lib/email";
import {
  CalendarEntry,
  CalendarStatus,
  arePlatforms,
  areTypes,
  isStatus,
  isValidIsoDate,
  isValidTime,
  isValidUrl,
  migrateRawEntry,
} from "@/lib/content-calendar";

const KEY = "content-calendar.json";
const FALLBACK = "./content-calendar.json";

const PETE_EMAIL = "pete@agecare-bathrooms.co.uk";

const STATUSES_TO_NOTIFY_PETE: CalendarStatus[] = [
  "To Check - Pete",
  "Awaiting Finance Approval",
];
const STATUSES_TO_NOTIFY_SUBMITTER: CalendarStatus[] = [
  "Approved",
  "Suggested Changes",
];

function getOrigin(request: NextRequest): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function notifyCalendarStatus(opts: {
  recipientEmail: string;
  recipientLabel: string;
  entry: CalendarEntry;
  actorLabel: string;
  actorEmail: string;
  notes?: string;
  origin: string;
}): Promise<void> {
  const { recipientEmail, recipientLabel, entry, actorLabel, actorEmail, notes, origin } = opts;
  const link = `${origin}/content-calendar`;

  const [pref] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userEmail, recipientEmail))
    .limit(1)
    .catch(() => [] as typeof notificationPrefs.$inferSelect[]);
  const wantInApp = pref?.contentCalendarInApp ?? true;
  const wantEmail = pref?.contentCalendarEmail ?? true;

  if (wantInApp) {
    await db.insert(notifications).values({
      recipientEmail,
      kind: "calendar_status",
      noteId: null,
      taskId: null,
      actorEmail,
      payload: {
        actorLabel,
        itemTitle: entry.title,
        itemKind: entry.platforms.join(", "),
        itemUrl: "/content-calendar",
        newStatus: entry.status,
      },
    }).catch(() => {});
  }

  if (wantEmail) {
    sendCalendarStatusEmail({
      to: recipientEmail,
      recipientLabel,
      actorLabel,
      title: entry.title,
      platform: entry.platforms.join(", "),
      liveDate: entry.liveDate,
      newStatus: entry.status,
      notes,
      link,
    }).catch(() => {});
  }
}

function fireStatusEmail(opts: {
  entry: CalendarEntry;
  prevStatus: CalendarStatus | null;
  actorEmail: string;
  actorLabel: string;
  origin: string;
}): void {
  const { entry, prevStatus, actorEmail, actorLabel, origin } = opts;
  if (entry.status === prevStatus) return;

  if (
    STATUSES_TO_NOTIFY_PETE.includes(entry.status) &&
    actorEmail.toLowerCase() !== PETE_EMAIL
  ) {
    notifyCalendarStatus({
      recipientEmail: PETE_EMAIL,
      recipientLabel: "Pete",
      entry,
      actorEmail,
      actorLabel,
      notes: entry.notes,
      origin,
    }).catch((e) => console.error("[notify-calendar] failed:", e));
    return;
  }

  if (
    STATUSES_TO_NOTIFY_SUBMITTER.includes(entry.status) &&
    entry.submittedBy.toLowerCase() !== actorEmail.toLowerCase()
  ) {
    notifyCalendarStatus({
      recipientEmail: entry.submittedBy,
      recipientLabel: entry.submittedByLabel,
      entry,
      actorEmail,
      actorLabel,
      notes: entry.feedback ?? entry.notes,
      origin,
    }).catch((e) => console.error("[notify-calendar] failed:", e));
  }
}

function newId(): string {
  return `cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function read(): Promise<CalendarEntry[]> {
  const raw = await loadJson<unknown[]>(KEY, FALLBACK, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(migrateRawEntry)
    .filter((e): e is CalendarEntry => e !== null);
}

async function write(items: CalendarEntry[]): Promise<void> {
  await saveJson(KEY, FALLBACK, items);
}

function sanitiseLinks(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const links = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  for (const link of links) {
    if (!isValidUrl(link)) return undefined;
  }
  return links.length ? links : [];
}

function trimOrUndef(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const items = await read();
  return Response.json({ items });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = trimOrUndef(body.title);
  if (!title) return Response.json({ error: "title required" }, { status: 400 });

  const liveDate = trimOrUndef(body.liveDate);
  if (!liveDate || !isValidIsoDate(liveDate)) {
    return Response.json({ error: "liveDate must be YYYY-MM-DD" }, { status: 400 });
  }

  if (!arePlatforms(body.platforms)) {
    return Response.json({ error: "platforms must be a non-empty array of valid platforms" }, { status: 400 });
  }
  const platforms = Array.from(new Set(body.platforms));

  const time = trimOrUndef(body.time);
  if (time && !isValidTime(time)) {
    return Response.json({ error: "time must be HH:MM" }, { status: 400 });
  }

  let types: CalendarEntry["types"] = [];
  if (body.types !== undefined) {
    if (!areTypes(body.types)) {
      return Response.json({ error: "types must be an array of valid types" }, { status: 400 });
    }
    types = Array.from(new Set(body.types));
  }

  const assetLink = trimOrUndef(body.assetLink);
  if (assetLink && !isValidUrl(assetLink)) {
    return Response.json({ error: "assetLink must be a valid http(s) url" }, { status: 400 });
  }

  const supportedLinks = sanitiseLinks(body.supportedLinks);
  if (body.supportedLinks !== undefined && supportedLinks === undefined) {
    return Response.json({ error: "supportedLinks must be an array of valid http(s) urls" }, { status: 400 });
  }

  const needsFinanceApproval = body.needsFinanceApproval === true;
  const status = isStatus(body.status)
    ? body.status
    : needsFinanceApproval ? "Awaiting Finance Approval" : "Not Started";

  const label = trimOrUndef(body.label) ?? user.email;

  const entry: CalendarEntry = {
    id: newId(),
    liveDate,
    time: time || undefined,
    platforms,
    types,
    status,
    title,
    notes: trimOrUndef(body.notes),
    responsible: trimOrUndef(body.responsible),
    assetLink,
    supportedLinks: supportedLinks && supportedLinks.length ? supportedLinks : undefined,
    feedback: trimOrUndef(body.feedback),
    needsFinanceApproval,
    submittedBy: user.email,
    submittedByLabel: label,
    submittedAt: new Date().toISOString(),
  };

  const items = await read();
  items.push(entry);
  await write(items);
  fireStatusEmail({
    entry,
    prevStatus: null,
    actorEmail: user.email,
    actorLabel: label,
    origin: getOrigin(request),
  });
  return Response.json({ item: entry, items });
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const items = await read();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return Response.json({ error: "not found" }, { status: 404 });

  const current = items[idx];
  const next: CalendarEntry = { ...current };
  const isPete = user.email.toLowerCase() === PETE_EMAIL;

  if (body.title !== undefined) {
    const title = trimOrUndef(body.title);
    if (!title) return Response.json({ error: "title cannot be empty" }, { status: 400 });
    next.title = title;
  }
  if (body.liveDate !== undefined) {
    const liveDate = trimOrUndef(body.liveDate);
    if (!liveDate || !isValidIsoDate(liveDate)) {
      return Response.json({ error: "liveDate must be YYYY-MM-DD" }, { status: 400 });
    }
    next.liveDate = liveDate;
  }
  if (body.time !== undefined) {
    const time = trimOrUndef(body.time);
    if (time && !isValidTime(time)) {
      return Response.json({ error: "time must be HH:MM" }, { status: 400 });
    }
    next.time = time;
  }
  if (body.platforms !== undefined) {
    if (!arePlatforms(body.platforms)) {
      return Response.json({ error: "platforms must be a non-empty array of valid platforms" }, { status: 400 });
    }
    next.platforms = Array.from(new Set(body.platforms));
  }
  if (body.types !== undefined) {
    if (!areTypes(body.types)) {
      return Response.json({ error: "types must be an array of valid types" }, { status: 400 });
    }
    next.types = Array.from(new Set(body.types));
  }
  if (body.status !== undefined) {
    if (!isStatus(body.status)) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }
    if ((body.status === "Approved" || body.status === "Suggested Changes") && !isPete) {
      return Response.json(
        { error: "only Pete can mark a piece as Approved or Suggested Changes" },
        { status: 403 },
      );
    }
    next.status = body.status;
  }
  if (body.assetLink !== undefined) {
    const assetLink = trimOrUndef(body.assetLink);
    if (assetLink && !isValidUrl(assetLink)) {
      return Response.json({ error: "assetLink must be a valid http(s) url" }, { status: 400 });
    }
    next.assetLink = assetLink;
  }
  if (body.supportedLinks !== undefined) {
    const supportedLinks = sanitiseLinks(body.supportedLinks);
    if (supportedLinks === undefined) {
      return Response.json({ error: "supportedLinks must be an array of valid http(s) urls" }, { status: 400 });
    }
    next.supportedLinks = supportedLinks.length ? supportedLinks : undefined;
  }
  if (body.notes !== undefined) next.notes = trimOrUndef(body.notes);
  if (body.responsible !== undefined) next.responsible = trimOrUndef(body.responsible);
  if (body.feedback !== undefined) next.feedback = trimOrUndef(body.feedback);
  if (typeof body.content === "string") next.content = body.content;
  if (body.needsFinanceApproval !== undefined) {
    next.needsFinanceApproval = body.needsFinanceApproval === true;
  }

  next.updatedBy = user.email;
  next.updatedByLabel = trimOrUndef(body.label) ?? user.email;
  next.updatedAt = new Date().toISOString();
  items[idx] = next;
  await write(items);
  fireStatusEmail({
    entry: next,
    prevStatus: current.status,
    actorEmail: user.email,
    actorLabel: next.updatedByLabel ?? user.email,
    origin: getOrigin(request),
  });
  return Response.json({ item: next, items });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const items = await read();
  const target = items.find((i) => i.id === id);
  if (!target) return Response.json({ error: "not found" }, { status: 404 });

  const isPete = user.email.toLowerCase() === PETE_EMAIL;
  const isSubmitter = target.submittedBy.toLowerCase() === user.email.toLowerCase();
  if (!isPete && !isSubmitter) {
    return Response.json({ error: "only the submitter or Pete can delete this entry" }, { status: 403 });
  }

  const filtered = items.filter((i) => i.id !== id);
  await write(filtered);
  return Response.json({ items: filtered });
}
