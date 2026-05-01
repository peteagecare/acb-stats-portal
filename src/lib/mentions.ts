// Server-side helpers to extract @mentions and per-task assignees from
// the HTML produced by the Tiptap editor.
//
// Each mention chip is rendered as:
//   <span class="note-mention" data-mention-email="..." data-mention-label="..." data-committed="true|false">@Name</span>
//
// "Pending" mentions (data-committed="false") have an open composer in the
// editor; we ignore them server-side so no notification fires until the user
// finishes writing the message and presses send. Absent attribute counts as
// committed for backward compatibility with mentions inserted before this
// feature.
//
// Task items still look like:
//   <li data-checked="..." data-task-id="UUID">…content…</li>

const TASK_ITEM_RE = /<li[^>]*\bdata-task-id="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g;

function isCommittedSpan(spanOpenTag: string): boolean {
  // Treat absent attribute as committed; only "false" means pending.
  const m = spanOpenTag.match(/data-committed="([^"]+)"/);
  if (!m) return true;
  return m[1] !== "false";
}

/** Iterate all committed mention chips in a fragment of HTML. */
function* committedMentions(html: string): Generator<{ tag: string; email: string }> {
  const re = /<span\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const emailMatch = attrs.match(/data-mention-email="([^"]+)"/);
    if (!emailMatch) continue;
    if (!isCommittedSpan(m[0])) continue;
    yield { tag: m[0], email: emailMatch[1].trim().toLowerCase() };
  }
}

export function extractMentionEmails(html: string): string[] {
  const out = new Set<string>();
  for (const m of committedMentions(html)) out.add(m.email);
  return [...out];
}

/** For each task item that contains at least one COMMITTED mention, return
 *  { taskId, email } using the FIRST committed mention inside that item. */
export function extractTaskAssignments(
  html: string,
): { taskId: string; email: string }[] {
  const out: { taskId: string; email: string }[] = [];
  for (const m of html.matchAll(TASK_ITEM_RE)) {
    const taskId = m[1];
    const inner = m[2];
    const first = committedMentions(inner).next();
    if (!first.done && first.value) {
      out.push({ taskId, email: first.value.email });
    }
  }
  return out;
}

const BLOCK_TYPES = ["p", "li", "h1", "h2", "h3", "blockquote"] as const;

/** Find the first block (p, li, h1-3, blockquote) that contains a COMMITTED
 *  mention of `email`, and return its plain-text content (stripped of all
 *  tags), truncated to ~240 chars. */
export function extractExcerptForMention(html: string, email: string): string | null {
  for (const tag of BLOCK_TYPES) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
    for (const m of html.matchAll(re)) {
      const inner = m[1];
      let hit = false;
      for (const mention of committedMentions(inner)) {
        if (mention.email === email) { hit = true; break; }
      }
      if (!hit) continue;
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
