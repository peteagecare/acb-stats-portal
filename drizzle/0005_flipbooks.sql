-- Flipbooks: PDF → page-flipping browser viewer with interactive overlays
-- (videos, links, GIFs). PDF + page PNGs live in Vercel Blob; manifest +
-- overlay coords live here. Client-side rasterisation avoids needing
-- poppler on Vercel runtime.
CREATE TABLE IF NOT EXISTS "flipbooks" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "owner_email" text NOT NULL,
  "page_count" integer NOT NULL,
  "page_width" integer NOT NULL,
  "page_height" integer NOT NULL,
  "source_pdf_url" text NOT NULL,
  "page_urls" jsonb NOT NULL,
  "settings" jsonb NOT NULL,
  "overlays" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "flipbooks_owner_idx"
  ON "flipbooks" ("owner_email", "created_at" DESC);
