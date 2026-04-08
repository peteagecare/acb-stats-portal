# ACB Stats Portal

Internal marketing dashboard for **Age Care Bathrooms**. Pulls live data from
HubSpot CRM, Google Analytics 4, Facebook, Google Places, and Anthropic for
AI-generated insights. Built with Next.js 16 (App Router).

> **Access**: password-protected. Single shared password set via env var.
> Sessions are HMAC-signed httpOnly cookies, valid for 14 days.

## Local development

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000. You'll be redirected to `/login` —
sign in with the value of `DASHBOARD_PASSWORD`.

## Required environment variables

Create `.env.local` (gitignored) with:

```bash
# Auth — REQUIRED
AUTH_SECRET=                   # 32+ char random string (e.g. `openssl rand -hex 32`)
DASHBOARD_PASSWORD=            # the shared password staff use to sign in

# HubSpot
HUBSPOT_ACCESS_TOKEN=          # private app token

# Google Analytics 4
GA4_PROPERTY_ID=
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./ga-service-account.json   # local only
# On Vercel use this instead (paste the JSON file contents):
# GOOGLE_SERVICE_ACCOUNT_KEY=

# Google Places
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACE_ID=

# Facebook
FACEBOOK_PAGE_TOKEN=
FACEBOOK_PAGE_ID=

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=

# Anthropic (used by /api/ai-chat and /api/ai-insights)
ANTHROPIC_API_KEY=
```

`ga-service-account.json` is also gitignored — never commit it.

## Security

- All routes (pages **and** API) sit behind `proxy.ts`. Unauthenticated
  requests to pages are redirected to `/login`; unauthenticated API requests
  return 401.
- Sessions are HMAC-SHA256 signed cookies — see [src/lib/auth.ts](src/lib/auth.ts).
- Hard-to-guess `AUTH_SECRET` is required at startup.
- AI endpoints are rate-limited per IP via [src/lib/rate-limit.ts](src/lib/rate-limit.ts)
  to prevent runaway Anthropic spend.
- Security headers (HSTS, X-Frame-Options DENY, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy) are set in [next.config.ts](next.config.ts).
- `noindex, nofollow` is set in the layout metadata so the dashboard never
  appears in search results.

## Deployment (Vercel)

1. Push to `main` — Vercel auto-deploys.
2. Add **all** the env vars above in Vercel → Settings → Environment Variables
   for the `Production` and `Preview` environments.
3. For `GOOGLE_SERVICE_ACCOUNT_KEY`, paste the **entire JSON contents** of
   `ga-service-account.json` (not the file path).
4. Configure custom domain `stats.agecare.co.uk` in Vercel → Settings → Domains
   and add the CNAME record Vercel gives you in your DNS provider.

## Notable conventions

- This is **Next.js 16**. The `middleware` file convention has been renamed to
  `proxy` — see [proxy.ts](proxy.ts). Always read
  `node_modules/next/dist/docs/` before assuming an API exists.
- The dashboard uses inline `style={}` rather than Tailwind classes.
  Mobile responsiveness is layered on top via `@media` rules in
  [src/app/globals.css](src/app/globals.css) that target the
  `.dashboard-root` class.
