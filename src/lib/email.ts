// Minimal Resend client over fetch (no npm dep needed).
// Free tier: 100 emails/day from `onboarding@resend.dev` without domain
// verification — fine for low-volume internal logins.

export async function sendLoginLink(to: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";

  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!to) throw new Error("recipient email is required");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 12px;font-size:18px">Sign in to Age Care Marketing Hub</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#475569">
        Click the button below to sign in. This link expires in 15 minutes.
      </p>
      <p style="margin:0 0 20px">
        <a href="${link}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:12px 24px;
                  border-radius:10px;font-size:15px">
          Sign in to Marketing Hub
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break:break-all">${link}</span>
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#94A3B8">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Sign in to Age Care Marketing Hub",
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

export async function sendMentionEmail(opts: {
  to: string;
  actorLabel: string;
  noteTitle: string;
  noteUrl: string;
  excerpt?: string;
  isAssignment: boolean;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return; // silently skip if not configured

  const noteTitle = opts.noteTitle?.trim() || "a meeting note";
  const subject = opts.isAssignment
    ? `${opts.actorLabel} assigned you a task in "${noteTitle}"`
    : `${opts.actorLabel} mentioned you in "${noteTitle}"`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 12px;font-size:18px">${escape(subject)}</h2>
      ${opts.excerpt ? `<blockquote style="margin:0 0 16px;padding:10px 14px;background:#F1F5F9;border-radius:8px;border-left:3px solid #2563eb;font-size:14px;color:#1e293b">${escape(opts.excerpt)}</blockquote>` : ""}
      <p style="margin:0 0 20px">
        <a href="${escape(opts.noteUrl)}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          Open ${opts.isAssignment ? "task" : "note"}
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">
        Marketing Hub · You're receiving this because you were ${opts.isAssignment ? "assigned a task" : "mentioned"}.
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: opts.to, subject, html }),
  }).catch(() => {});
}

export async function sendTaskAssignedEmail(opts: {
  to: string;
  actorLabel: string;
  taskTitle: string;
  projectName: string;
  companyName: string;
  taskUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const subject = `${opts.actorLabel} assigned you a task: "${opts.taskTitle}"`;
  const breadcrumb = `${opts.companyName} › ${opts.projectName}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 6px;font-size:18px">${escape(subject)}</h2>
      <div style="margin:0 0 16px;font-size:12px;color:#64748B">${escape(breadcrumb)}</div>
      <p style="margin:0 0 20px">
        <a href="${escape(opts.taskUrl)}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          Open task
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">
        Marketing Hub · You're receiving this because you were assigned a task.
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: opts.to, subject, html }),
  }).catch(() => {});
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
