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

export async function sendNoteSharedEmail(opts: {
  to: string;
  actorLabel: string;
  noteTitle: string;
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const subject = `${opts.actorLabel} shared "${opts.noteTitle}" with you`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 6px;font-size:18px">${escape(subject)}</h2>
      <div style="margin:0 0 16px;font-size:12px;color:#64748B">Meeting note</div>
      <p style="margin:0 0 20px">
        <a href="${escape(opts.url)}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          Open meeting note
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">Marketing Hub</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject, html }),
  }).catch(() => {});
}

export async function sendReviewEmail(opts: {
  to: string;
  recipientLabel: string;
  platformName: string;
  delta: number;
  newCount: number;
  newRating: number;
  oldRating: number;
  ratingDropped: boolean;
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const subject = opts.ratingDropped
    ? `⚠ ${opts.platformName} rating dropped to ${opts.newRating.toFixed(1)}`
    : `+${opts.delta} new ${opts.platformName} review${opts.delta === 1 ? "" : "s"}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 6px;font-size:18px;${opts.ratingDropped ? "color:#b91c1c" : ""}">${escape(subject)}</h2>
      <div style="margin:0 0 16px;font-size:13px;color:#475569">
        ${escape(opts.platformName)} now sits at <strong>${opts.newCount.toLocaleString()}</strong> reviews
        ${opts.newRating > 0 ? `· average ★ ${opts.newRating.toFixed(1)}` : ""}
        ${opts.ratingDropped ? `<span style="color:#b91c1c"> (was ${opts.oldRating.toFixed(1)})</span>` : ""}
      </div>
      <p style="margin:0 0 20px">
        <a href="${escape(opts.url)}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          Open Reviews & Social
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">Marketing Hub</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject, html }),
  }).catch(() => {});
}

export async function sendCommentEmail(opts: {
  to: string;
  actorLabel: string;
  parentTitle: string;
  parentKind: "task" | "project";
  breadcrumb: string;
  excerpt: string;
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const subject = `${opts.actorLabel} commented on "${opts.parentTitle}"`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 6px;font-size:18px">${escape(subject)}</h2>
      <div style="margin:0 0 16px;font-size:12px;color:#64748B">${escape(opts.breadcrumb)}</div>
      <div style="background:#f8fafc;border-left:3px solid #2563eb;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#334155;white-space:pre-wrap">${escape(opts.excerpt)}</div>
      <p style="margin:0 0 20px">
        <a href="${escape(opts.url)}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          Open ${escape(opts.parentKind)}
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">Marketing Hub</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject, html }),
  }).catch(() => {});
}

export async function sendTaskCompletedEmail(opts: {
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

  const subject = `${opts.actorLabel} completed: "${opts.taskTitle}"`;
  const breadcrumb = `${opts.companyName} › ${opts.projectName}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 6px;font-size:18px">${escape(subject)}</h2>
      <div style="margin:0 0 16px;font-size:12px;color:#64748B">${escape(breadcrumb)}</div>
      <p style="margin:0 0 20px">
        <a href="${escape(opts.taskUrl)}"
           style="display:inline-block;background:#30A46C;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          Open task
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">
        Marketing Hub · You're receiving this because you assigned the task.
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject, html }),
  }).catch(() => {});
}

export async function sendCalendarStatusEmail(opts: {
  to: string;
  recipientLabel: string;
  actorLabel: string;
  title: string;
  platform: string;
  liveDate: string;
  newStatus: string;
  notes?: string;
  link: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const subject = `[Calendar] ${opts.actorLabel}: "${opts.title}" → ${opts.newStatus}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 6px;font-size:18px">${escape(opts.title)}</h2>
      <div style="margin:0 0 16px;font-size:12px;color:#64748B">
        ${escape(opts.platform)} · ${escape(opts.liveDate)}
      </div>
      <p style="margin:0 0 12px;font-size:14px">
        Hi ${escape(opts.recipientLabel)},
      </p>
      <p style="margin:0 0 16px;font-size:14px">
        ${escape(opts.actorLabel)} moved this content piece to
        <strong style="color:#1e40af">${escape(opts.newStatus)}</strong>.
      </p>
      ${opts.notes ? `<div style="background:#f8fafc;border-left:3px solid #2563eb;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#334155;white-space:pre-wrap">${escape(opts.notes)}</div>` : ""}
      <p style="margin:0 0 20px">
        <a href="${escape(opts.link)}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          Open content calendar
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">
        Marketing Hub · Content Calendar
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

export async function sendApprovalStepEmail(opts: {
  to: string;
  recipientLabel: string;
  actorLabel: string;
  action: "approve" | "reject";
  itemTitle: string;
  itemKind: string;
  rejectionNote: string | null;
  link: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const isReject = opts.action === "reject";
  const verb = isReject ? "sent back for changes" : "approved";
  const subject = isReject
    ? `[Finance] ${opts.actorLabel} sent "${opts.itemTitle}" back for changes`
    : `[Finance] Your turn: "${opts.itemTitle}" needs your approval`;
  const cta = isReject ? "Open and review the changes" : "Review and approve";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 6px;font-size:18px">${escape(opts.itemTitle)}</h2>
      <div style="margin:0 0 16px;font-size:12px;color:#64748B">${escape(opts.itemKind)}</div>
      <p style="margin:0 0 12px;font-size:14px">Hi ${escape(opts.recipientLabel)},</p>
      <p style="margin:0 0 16px;font-size:14px">
        ${escape(opts.actorLabel)} ${verb} this item${isReject ? "" : " — it's now waiting on you"}.
      </p>
      ${opts.rejectionNote ? `<div style="background:#fef2f2;border-left:3px solid #dc2626;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#991b1b;white-space:pre-wrap"><strong>Note:</strong> ${escape(opts.rejectionNote)}</div>` : ""}
      <p style="margin:0 0 20px">
        <a href="${escape(opts.link)}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          ${escape(cta)}
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">
        Marketing Hub · Financial approvals
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

interface DigestTaskItem { title: string; url: string; project: string; endDate?: string; }
interface DigestGoLiveItem { id: string; title: string; platform: string; status: string; time: string; missingAsset: boolean; }
interface DigestTeamChange { text: string; author: string; }

export async function sendDailyDigestEmail(opts: {
  to: string;
  recipientLabel: string;
  date: string;
  origin: string;
  sections: {
    tasksDue: DigestTaskItem[];
    tasksOverdue: DigestTaskItem[];
    goLiveToday: DigestGoLiveItem[];
    siteVisitsThisWeek: number;
    teamChangesYesterday: DigestTeamChange[];
  };
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const { tasksDue, tasksOverdue, goLiveToday, siteVisitsThisWeek, teamChangesYesterday } = opts.sections;

  function section(title: string, body: string): string {
    if (!body) return "";
    return `
      <div style="margin:0 0 18px">
        <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">${escape(title)}</div>
        ${body}
      </div>
    `;
  }
  function taskList(items: DigestTaskItem[]): string {
    return items.map((t) => `
      <div style="padding:6px 0;border-top:1px solid #E5E7EB">
        <a href="${escape(t.url)}" style="color:#0F172A;text-decoration:none;font-size:13px;font-weight:500">${escape(t.title)}</a>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">${escape(t.project)}${t.endDate ? ` · due ${escape(t.endDate)}` : ""}</div>
      </div>
    `).join("");
  }

  const goLiveBody = goLiveToday.length === 0 ? "" : goLiveToday.map((g) => `
    <div style="padding:6px 0;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;gap:8px">
      <div>
        <div style="font-size:13px;font-weight:500">${escape(g.title)}${g.missingAsset ? ` <span style="color:#b91c1c;font-size:11px">⚠ no asset</span>` : ""}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">${escape(g.platform)}${g.time ? ` · ${escape(g.time)}` : ""}</div>
      </div>
      <span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;background:#F1F5F9;color:#475569;align-self:flex-start;white-space:nowrap">${escape(g.status)}</span>
    </div>
  `).join("");

  const tcBody = teamChangesYesterday.length === 0 ? "" : teamChangesYesterday.map((t) => `
    <div style="padding:6px 0;border-top:1px solid #E5E7EB;font-size:13px">
      ${escape(t.text)}
      <div style="font-size:11px;color:#94A3B8;margin-top:2px">${escape(t.author.split("@")[0])}</div>
    </div>
  `).join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#0F172A">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:600">Good morning, ${escape(opts.recipientLabel)}</h1>
      <div style="font-size:13px;color:#64748B;margin-bottom:24px">${escape(opts.date)}</div>
      ${section("Due today", tasksDue.length ? taskList(tasksDue) : "")}
      ${section("Overdue", tasksOverdue.length ? taskList(tasksOverdue) : "")}
      ${section("Going live today", goLiveBody)}
      ${siteVisitsThisWeek > 0 ? section("Site visits this week", `<div style="font-size:14px">${siteVisitsThisWeek} home visit${siteVisitsThisWeek === 1 ? "" : "s"} booked</div>`) : ""}
      ${section("Team changes yesterday", tcBody)}
      <p style="margin:24px 0 0;font-size:12px;color:#94A3B8">
        <a href="${escape(opts.origin)}" style="color:#0071E3;text-decoration:none">Open dashboard →</a><br>
        Marketing Hub · Daily digest. Mute in <a href="${escape(opts.origin)}/settings" style="color:#94A3B8">settings</a>.
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject: `Daily digest · ${opts.date}`, html }),
  }).catch(() => {});
}

export async function sendWeeklyDigestEmail(opts: {
  to: string;
  recipientLabel: string;
  weekLabel: string;
  origin: string;
  funnel: { contacts: number; prospects: number; leads: number; siteVisits: number; won: number; wonValue: number };
  thisWeekContent: { title: string; platform: string; status: string; liveDate: string }[];
  overdue: { title: string; url: string; project: string; endDate: string }[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const { funnel } = opts;
  const fmtCurrency = (n: number) => n >= 1000 ? `£${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `£${Math.round(n).toLocaleString()}`;

  const funnelRow = (label: string, value: string | number, color: string) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#475569">
        <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${color};margin-right:8px"></span>${escape(label)}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:600;text-align:right">${escape(String(value))}</td>
    </tr>
  `;

  const contentRows = opts.thisWeekContent.length === 0 ? "" : opts.thisWeekContent.map((c) => `
    <div style="padding:6px 0;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;gap:8px">
      <div>
        <div style="font-size:13px;font-weight:500">${escape(c.title)}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">${escape(c.platform)} · ${escape(c.liveDate)}</div>
      </div>
      <span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;background:#F1F5F9;color:#475569;align-self:flex-start;white-space:nowrap">${escape(c.status)}</span>
    </div>
  `).join("");

  const overdueRows = opts.overdue.length === 0 ? "" : opts.overdue.map((t) => `
    <div style="padding:6px 0;border-top:1px solid #E5E7EB">
      <a href="${escape(t.url)}" style="color:#0F172A;text-decoration:none;font-size:13px;font-weight:500">${escape(t.title)}</a>
      <div style="font-size:11px;color:#94A3B8;margin-top:2px">${escape(t.project)} · was due ${escape(t.endDate)}</div>
    </div>
  `).join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#0F172A">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:600">Hey ${escape(opts.recipientLabel)}</h1>
      <div style="font-size:13px;color:#64748B;margin-bottom:24px">Weekly digest · ${escape(opts.weekLabel)}</div>

      <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Last week's funnel</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${funnelRow("Contacts", funnel.contacts, "#0071E3")}
        ${funnelRow("Prospects", funnel.prospects, "#E8833A")}
        ${funnelRow("Leads", funnel.leads, "#8E4EC6")}
        ${funnelRow("Site visits", funnel.siteVisits, "#D93D42")}
        ${funnelRow("Won jobs", funnel.won, "#30A46C")}
        ${funnelRow("Won value", fmtCurrency(funnel.wonValue), "#30A46C")}
      </table>

      ${opts.thisWeekContent.length > 0 ? `
        <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">This week's content</div>
        <div style="margin-bottom:20px">${contentRows}</div>
      ` : ""}

      ${opts.overdue.length > 0 ? `
        <div style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Your overdue tasks</div>
        <div style="margin-bottom:20px">${overdueRows}</div>
      ` : ""}

      <p style="margin:24px 0 0;font-size:12px;color:#94A3B8">
        <a href="${escape(opts.origin)}" style="color:#0071E3;text-decoration:none">Open dashboard →</a><br>
        Marketing Hub · Weekly digest. Mute in <a href="${escape(opts.origin)}/settings" style="color:#94A3B8">settings</a>.
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject: `Weekly digest · ${opts.weekLabel}`, html }),
  }).catch(() => {});
}

export async function sendSubscriptionReminderEmail(opts: {
  to: string;
  upcoming: { name: string; renewalDate: string; daysUntil: number; gbpCost: number; category: string }[];
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "Age Care Marketing Hub <onboarding@resend.dev>";
  if (!apiKey) return;

  const subject = opts.upcoming.length === 1
    ? `${opts.upcoming[0].name} renews in ${opts.upcoming[0].daysUntil} days`
    : `${opts.upcoming.length} subscriptions renewing soon`;

  const totalGbp = opts.upcoming.reduce((s, u) => s + u.gbpCost, 0);
  const fmtCurrency = (n: number) => n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${Math.round(n).toLocaleString()}`;

  const rows = opts.upcoming.map((u) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px">
        <strong>${escape(u.name)}</strong>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">${escape(u.category)}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;text-align:center">
        ${u.daysUntil === 0 ? "today" : `in ${u.daysUntil}d`}
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">${escape(u.renewalDate)}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:600;text-align:right">${escape(fmtCurrency(u.gbpCost))}</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 6px;font-size:18px">${escape(subject)}</h2>
      <div style="margin:0 0 16px;font-size:12px;color:#64748B">Heads-up before money leaves the account</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        ${rows}
        <tr>
          <td colspan="2" style="padding:8px 12px;font-size:12px;color:#64748B">Total renewing</td>
          <td style="padding:8px 12px;font-size:14px;font-weight:600;text-align:right">${escape(fmtCurrency(totalGbp))}</td>
        </tr>
      </table>
      <p style="margin:0 0 20px">
        <a href="${escape(opts.url)}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:10px 20px;
                  border-radius:10px;font-size:14px">
          Review subscriptions
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">Marketing Hub · Subscription reminder</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
