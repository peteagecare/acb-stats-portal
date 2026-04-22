import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const KEY = "automation-layout.json";
const FALLBACK = "./automation-layout.json";

export interface NodePos {
  id: string;
  x: number;
  y: number;
}

export interface Connection {
  from: string;
  to: string;
  note?: string;
}

export interface CustomNode {
  id: string;
  label: string;
  notes: string;
  color: string;
  x: number;
  y: number;
}

export interface LayoutData {
  positions: NodePos[];
  connections: Connection[];
  customNodes?: CustomNode[];
}

const DEFAULTS: LayoutData = { positions: [], connections: [], customNodes: [] };

export async function GET() {
  const data = await loadJson<LayoutData>(KEY, FALLBACK, DEFAULTS);
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }
  const body: LayoutData = await request.json();
  await saveJson(KEY, FALLBACK, body);
  return Response.json(body);
}
