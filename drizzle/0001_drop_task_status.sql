-- Drop the task_status column from tasks and the task_status enum.
-- The task `completed` flag plus the `sectionId` (whose name can be a
-- "Done"-family section) now provide everything `status` did.
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "status";
DROP TYPE IF EXISTS "task_status";
