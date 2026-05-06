CREATE TABLE IF NOT EXISTS "inbox_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "owner_email" text NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "end_date" date,
  "promoted_task_id" uuid,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_email" text NOT NULL
);
