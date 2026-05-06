-- Lead capture gate for flipbooks: per-flipbook config (lives on flipbooks.lead_gate)
-- and a submissions log (flipbook_leads). Cookie-based recognition lets returning
-- readers skip the gate; HubSpot Forms API forwarding is best-effort.
ALTER TABLE "flipbooks" ADD COLUMN IF NOT EXISTS "lead_gate" jsonb;

CREATE TABLE IF NOT EXISTS "flipbook_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "flipbook_id" text NOT NULL REFERENCES "flipbooks"("id") ON DELETE CASCADE,
  "cookie_id" text NOT NULL,
  "email" text,
  "fields" jsonb NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "hubspot_submitted_at" timestamp with time zone,
  "hubspot_error" text,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "flipbook_leads_cookie_idx"
  ON "flipbook_leads" ("flipbook_id", "cookie_id");

CREATE INDEX IF NOT EXISTS "flipbook_leads_submitted_idx"
  ON "flipbook_leads" ("flipbook_id", "submitted_at" DESC);
