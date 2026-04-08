// Minimal Resend client over fetch (no npm dep needed).
// Free tier: 100 emails/day from `onboarding@resend.dev` without domain
// verification — fine for low-volume internal logins.

export async function sendLoginLink(to: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_EMAIL_FROM ?? "ACB Stats <onboarding@resend.dev>";

  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!to) throw new Error("recipient email is required");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F172A">
      <h2 style="margin:0 0 12px;font-size:18px">Sign in to ACB Stats Portal</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#475569">
        Click the button below to sign in. This link expires in 15 minutes.
      </p>
      <p style="margin:0 0 20px">
        <a href="${link}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  text-decoration:none;font-weight:600;padding:12px 24px;
                  border-radius:10px;font-size:15px">
          Sign in to Stats Portal
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
      subject: "Sign in to ACB Stats Portal",
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}
