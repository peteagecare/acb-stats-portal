// Client-side notification dismissals — kept in localStorage keyed by the
// recipient email. Server still stores the full history; we just filter the
// dismissed ones out of the bell popup. The full-history page can read
// `getDismissed()` to mark the dismissed rows visually.

const KEY_PREFIX = "acb.dismissed-notifications.";

function key(email: string): string {
  return KEY_PREFIX + email.toLowerCase();
}

export function getDismissed(email: string | null | undefined): Set<string> {
  if (!email || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key(email));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function save(email: string, set: Set<string>) {
  try {
    window.localStorage.setItem(key(email), JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent("acb-notifications-dismissed-changed"));
  } catch {
    // ignore quota / private-mode errors
  }
}

export function dismiss(email: string, ids: string[] | string): void {
  if (!email || typeof window === "undefined") return;
  const set = getDismissed(email);
  for (const id of Array.isArray(ids) ? ids : [ids]) set.add(id);
  save(email, set);
}

export function restore(email: string, ids: string[] | string): void {
  if (!email || typeof window === "undefined") return;
  const set = getDismissed(email);
  for (const id of Array.isArray(ids) ? ids : [ids]) set.delete(id);
  save(email, set);
}

export function clearAll(email: string): void {
  if (!email || typeof window === "undefined") return;
  save(email, new Set());
}
