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

const BLOCK_TYPES = ["p", "li", "h1", "h2", "h3", "blockquote"] as const;

/** Find the first block (p, li, h1-3, blockquote) that contains the given
 *  mention, and return its plain-text content (stripped of all tags),
 *  truncated to ~240 chars. Returns null if no enclosing block found. */
export function extractExcerptForMention(html: string, email: string): string | null {
  const needle = `data-mention-email="${email}"`;
  for (const tag of BLOCK_TYPES) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
    for (const m of html.matchAll(re)) {
      const inner = m[1];
      if (!inner.includes(needle)) continue;
      const text = stripTags(inner);
      if (!text) continue;
      return truncate(text, 240);
    }
  }
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}
