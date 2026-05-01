import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes, meetingNoteTasks } from "@/db/schema";
import { requireUser, canSeeNote } from "@/lib/workspace-auth";
import { loadUsers } from "@/lib/users";

interface Params { params: Promise<{ id: string }>; }

interface SummaryResult {
  overview: string;
  minutes: string[];
  tasks: { title: string; ownerLabel?: string | null; dueDate?: string | null }[];
}

const SYSTEM_PROMPT = `You are a precise meeting-notes assistant for a UK marketing team at Age Care Bathrooms. You receive a raw transcript of a meeting (auto-transcribed, so it may contain typos and uncertain words). Produce STRICT JSON only — no prose before or after.

Schema:
{
  "overview": string,        // 1-2 sentence high-level summary of the meeting
  "minutes": string[],       // 5-12 bullet points of the actual discussion, in chronological order
  "tasks": [                 // action items only — things someone explicitly committed to do
    {
      "title": string,       // imperative phrasing, e.g. "Email Chris about the new finance options"
      "ownerLabel": string | null,  // first name of who agreed to do it, or null if unclear
      "dueDate": string | null      // YYYY-MM-DD if a date was given, otherwise null
    }
  ]
}

Rules:
- Use British English.
- Do NOT invent action items. Only extract tasks where someone clearly agreed to do something.
- ownerLabel must be a first name (Pete, Chris, Sam, Mark, Owen, Asim) or null.
- Convert relative dates ("by Friday", "next week") to absolute YYYY-MM-DD using today's date as anchor.
- Output JSON only. No markdown fences.`;

export async function POST(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!(await canSeeNote(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { transcript?: string; createTasks?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  if (!transcript) return Response.json({ error: "transcript required" }, { status: 400 });
  if (transcript.length > 200_000) {
    return Response.json({ error: "transcript too long (max 200k chars)" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });

  const todayIso = new Date().toISOString().slice(0, 10);
  const userMessage = `Today's date: ${todayIso}\n\n--- Transcript ---\n${transcript}`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return Response.json({ error: `Claude error: ${err}` }, { status: 502 });
  }

  const aiBody = await aiRes.json();
  const text = aiBody?.content?.[0]?.text ?? "";
  let parsed: SummaryResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    return Response.json({ error: "AI response was not valid JSON", raw: text }, { status: 502 });
  }
  if (!parsed.overview || !Array.isArray(parsed.minutes) || !Array.isArray(parsed.tasks)) {
    return Response.json({ error: "AI response missing required fields", raw: parsed }, { status: 502 });
  }

  // Optionally write extracted tasks straight to meetingNoteTasks. The owner
  // is matched by first name against the known users list.
  let createdTaskIds: string[] = [];
  if (body.createTasks && parsed.tasks.length > 0) {
    const users = await loadUsers();
    const tasksToInsert = parsed.tasks
      .filter((t) => t.title && t.title.trim())
      .map((t) => {
        const owner = t.ownerLabel
          ? users.find((u) => u.label.toLowerCase() === t.ownerLabel!.toLowerCase())?.email ?? null
          : null;
        return {
          noteId: id,
          title: t.title.trim(),
          ownerEmail: owner,
          endDate: t.dueDate || null,
        };
      });
    if (tasksToInsert.length > 0) {
      const inserted = await db.insert(meetingNoteTasks).values(tasksToInsert).returning({ id: meetingNoteTasks.id });
      createdTaskIds = inserted.map((r) => r.id);
    }
  }

  // Bump the note's updatedAt so the summary creation surfaces in lists
  await db.update(meetingNotes).set({ updatedAt: new Date() }).where(eq(meetingNotes.id, id));

  return Response.json({
    ok: true,
    summary: parsed,
    createdTaskIds,
  });
}
