-- Per-user pinned/favourite projects. Lets two team members have different
-- "starred" projects in their sidebars and dashboards.
CREATE TABLE IF NOT EXISTS "project_favourites" (
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_email" text NOT NULL,
  "pinned_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("project_id", "user_email")
);

CREATE INDEX IF NOT EXISTS "project_favourites_user_idx"
  ON "project_favourites" ("user_email", "pinned_at" DESC);
