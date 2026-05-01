// Server-side helpers to extract @mentions and per-task assignees from
// the HTML produced by the Tiptap editor.
//
// The editor renders mentions as:
//   <span class="note-mention" data-mention-email="..." data-mention-label="...">@Name</span>
// and task items as:
//   <li data-checked="..." data-task-id="UUID">…content…</li>

const MENTION_RE = /data-mention-email="([^"]+)"/g;
const TASK_ITEM_RE = /<li[^>]*\bdata-task-id="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g;

export function extractMentionEmails(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(MENTION_RE)) {
    const email = m[1].trim().toLowerCase();
    if (email) out.add(email);
  }
  return [...out];
}

/** For each task item that contains at least one mention, return
 *  { taskId, email } using the FIRST mention inside that item. */
export function extractTaskAssignments(
  html: string,
): { taskId: string; email: string }[] {
  const out: { taskId: string; email: string }[] = [];
  for (const m of html.matchAll(TASK_ITEM_RE)) {
    const taskId = m[1];
    const inner = m[2];
    const first = inner.match(/data-mention-email="([^"]+)"/);
    if (first) out.push({ taskId, email: first[1].trim().toLowerCase() });
  }
  return out;
}
