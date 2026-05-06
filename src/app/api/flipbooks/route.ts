import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { flipbooks } from "@/db/schema";
import {
  DEFAULT_SETTINGS,
  type Overlay,
  type ProjectSettings,
} from "@/lib/flipbook/types";
import { requireUser } from "@/lib/workspace-auth";

export const runtime = "nodejs";

type CreateBody = {
  id: string;
  name: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  sourcePdfUrl: string;
  pageUrls: string[];
};

function isValidId(s: unknown): s is string {
  return typeof s === "string" && /^[A-Za-z0-9_-]{4,30}$/.test(s);
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function isBlobUrl(u: unknown): u is string {
  if (typeof u !== "string") return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  if (!body) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isValidId(body.id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  if (
    typeof body.name !== "string" ||
    body.name.trim().length === 0 ||
    body.name.length > 200
  ) {
    return Response.json({ error: "Invalid name" }, { status: 400 });
  }
  if (
    !isPositiveInt(body.pageCount) ||
    !isPositiveInt(body.pageWidth) ||
    !isPositiveInt(body.pageHeight)
  ) {
    return Response.json({ error: "Invalid page dimensions" }, { status: 400 });
  }
  if (!isBlobUrl(body.sourcePdfUrl)) {
    return Response.json({ error: "Invalid source PDF URL" }, { status: 400 });
  }
  if (
    !Array.isArray(body.pageUrls) ||
    body.pageUrls.length !== body.pageCount ||
    !body.pageUrls.every(isBlobUrl)
  ) {
    return Response.json({ error: "Invalid page URLs" }, { status: 400 });
  }

  const settings: ProjectSettings = { ...DEFAULT_SETTINGS };
  const overlays: Overlay[] = [];

  await db.insert(flipbooks).values({
    id: body.id,
    name: body.name.trim(),
    ownerEmail: user.email,
    pageCount: body.pageCount,
    pageWidth: body.pageWidth,
    pageHeight: body.pageHeight,
    sourcePdfUrl: body.sourcePdfUrl,
    pageUrls: body.pageUrls,
    settings,
    overlays,
  });

  return Response.json({ id: body.id });
}
