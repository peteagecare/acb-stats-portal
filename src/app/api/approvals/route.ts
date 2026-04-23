import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { loadJson, saveJson } from "@/lib/blob-store";
import { AnyApprovalKey, canApproveAny, isValidApprovalKey } from "@/lib/approval-roles";

const KEY = "approvals.json";
const FALLBACK = "./approvals.json";

export interface ApprovalRecord {
  approved: boolean;
  userEmail: string;
  userLabel: string;
  timestamp: string;
}

export interface RejectionRecord {
  byRole: AnyApprovalKey;
  userEmail: string;
  userLabel: string;
  note: string;
  timestamp: string;
}

export type EmailApprovals = Partial<Record<AnyApprovalKey, ApprovalRecord>> & {
  rejection?: RejectionRecord;
};

export type ApprovalsStore = Record<string, EmailApprovals>;

async function readStore(): Promise<ApprovalsStore> {
  return loadJson<ApprovalsStore>(KEY, FALLBACK, {});
}

async function writeStore(data: ApprovalsStore): Promise<void> {
  await saveJson(KEY, FALLBACK, data);
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const store = await readStore();
  return Response.json({ approvals: store });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { emailId?: string; role?: string; approved?: boolean; label?: string; override?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { emailId, role, approved, override } = body;
  if (!emailId || typeof emailId !== "string") {
    return Response.json({ error: "emailId required" }, { status: 400 });
  }
  if (!role || typeof role !== "string" || !isValidApprovalKey(role)) {
    return Response.json({ error: "invalid role" }, { status: 400 });
  }
  if (typeof approved !== "boolean") {
    return Response.json({ error: "approved must be boolean" }, { status: 400 });
  }

  if (!canApproveAny(role, user.email)) {
    return Response.json({ error: "You are not permitted to tick this approval." }, { status: 403 });
  }

  const store = await readStore();
  const emailRecord = store[emailId] ?? {};

  const typedRole = role as AnyApprovalKey;
  const userLabel = body.label?.trim() || user.email;
  if (approved && override === true && typedRole === "dnna_chris") {
    // Chris overrides when Pete went down the financial-approval path by mistake:
    // declare no approval was needed AND confirm, in one atomic write.
    const now = new Date().toISOString();
    emailRecord.dnna_pete = { approved: true, userEmail: user.email, userLabel: `${userLabel} (override)`, timestamp: now };
    emailRecord.dnna_chris = { approved: true, userEmail: user.email, userLabel, timestamp: now };
  } else if (approved) {
    emailRecord[typedRole] = {
      approved: true,
      userEmail: user.email,
      userLabel,
      timestamp: new Date().toISOString(),
    };
    // Pete re-approving after a rejection means the concerns have been addressed — clear it.
    if (typedRole === "pete" && emailRecord.rejection) {
      delete emailRecord.rejection;
    }
  } else {
    delete emailRecord[typedRole];
    // Unchecking Pete's DNNA also removes Chris's confirmation (prerequisite gone).
    if (typedRole === "dnna_pete") delete emailRecord.dnna_chris;
  }

  if (Object.keys(emailRecord).length === 0) {
    delete store[emailId];
  } else {
    store[emailId] = emailRecord;
  }

  await writeStore(store);

  return Response.json({
    ok: true,
    emailId,
    role: typedRole,
    record: emailRecord[typedRole] ?? null,
    emailRecord: store[emailId] ?? null,
  });
}

/** DELETE /api/approvals — send an email back to Pete with a rejection note.
 *  Body: { emailId: string, role: string, note: string }
 *  Clears all approvals for the email and records the rejection metadata.
 */
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { emailId?: string; role?: string; note?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { emailId, role, note } = body;
  if (!emailId || typeof emailId !== "string") {
    return Response.json({ error: "emailId required" }, { status: 400 });
  }
  if (!role || typeof role !== "string" || !isValidApprovalKey(role)) {
    return Response.json({ error: "invalid role" }, { status: 400 });
  }
  if (!canApproveAny(role, user.email)) {
    return Response.json({ error: "You are not permitted to reject on behalf of this role." }, { status: 403 });
  }
  const trimmedNote = (note ?? "").trim();
  if (!trimmedNote) {
    return Response.json({ error: "A note is required when sending back for changes." }, { status: 400 });
  }

  const store = await readStore();
  const rejection: RejectionRecord = {
    byRole: role as AnyApprovalKey,
    userEmail: user.email,
    userLabel: body.label?.trim() || user.email,
    note: trimmedNote,
    timestamp: new Date().toISOString(),
  };
  // Reset: clear every prior approval + DNNA; keep only the rejection record.
  store[emailId] = { rejection };
  await writeStore(store);

  return Response.json({ ok: true, emailId, rejection });
}
