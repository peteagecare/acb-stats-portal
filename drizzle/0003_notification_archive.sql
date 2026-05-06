-- Add archived_at to notifications. Archived notifications are hidden from
-- the bell + main list but remain queryable in the Archived tab, where they
-- can be restored or hard-deleted.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "notifications_recipient_archived_idx"
  ON "notifications" ("recipient_email", "archived_at");
