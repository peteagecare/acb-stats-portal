import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  boolean,
  real,
  jsonb,
  primaryKey,
  pgEnum,
  AnyPgColumn,
} from "drizzle-orm/pg-core";

export const accessModeEnum = pgEnum("access_mode", ["everyone", "restricted"]);
export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "done",
  "archived",
]);
export const projectTypeEnum = pgEnum("project_type", ["quarterly", "initiative", "ongoing"]);
export const departmentEnum = pgEnum("department", ["ppc", "seo", "content", "web"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  accessMode: accessModeEnum("access_mode").notNull().default("everyone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByEmail: text("created_by_email").notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  notes: text("notes"),
  ownerEmail: text("owner_email"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: projectStatusEnum("status").notNull().default("active"),
  type: projectTypeEnum("type").notNull().default("quarterly"),
  department: departmentEnum("department"),
  accessMode: accessModeEnum("access_mode").notNull().default("everyone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByEmail: text("created_by_email").notNull(),
});

export const sections = pgTable("sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
  parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  description: text("description"),
  ownerEmail: text("owner_email"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  priority: priorityEnum("priority"),
  estimatedHours: real("estimated_hours"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  goal: text("goal"),
  expectedOutcome: text("expected_outcome"),
  recurrence: jsonb("recurrence"),
  recurrenceSourceId: uuid("recurrence_source_id"),
  preCompletionSectionId: uuid("pre_completion_section_id").references(() => sections.id, {
    onDelete: "set null",
  }),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByEmail: text("created_by_email").notNull(),
});

export const companyAccess = pgTable(
  "company_access",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.userEmail] })],
);

export const projectAccess = pgTable(
  "project_access",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userEmail] })],
);

export const projectCollaborators = pgTable(
  "project_collaborators",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userEmail] })],
);

/** Per-user "pinned" projects. Each row = one user has favourited one project. */
export const projectFavourites = pgTable(
  "project_favourites",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userEmail] })],
);

export const taskCollaborators = pgTable(
  "task_collaborators",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userEmail] })],
);

export const parentTypeEnum = pgEnum("parent_type", ["project", "task"]);
export const attachmentStorageEnum = pgEnum("attachment_storage", ["blob", "external"]);

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentType: parentTypeEnum("parent_type").notNull(),
  parentId: uuid("parent_id").notNull(),
  body: text("body").notNull(),
  authorEmail: text("author_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentType: parentTypeEnum("parent_type").notNull(),
  parentId: uuid("parent_id").notNull(),
  storage: attachmentStorageEnum("storage").notNull(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  blobKey: text("blob_key"),
  sizeBytes: integer("size_bytes"),
  contentType: text("content_type"),
  uploadedByEmail: text("uploaded_by_email").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingNotes = pgTable("meeting_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  /** Raw meeting transcript captured by the live recorder. Surfaced in a modal
   *  via a "View transcript" button on the note; preserved when the body's
   *  live-transcript paragraphs get replaced by the AI summary. */
  transcript: text("transcript").notNull().default(""),
  meetingDate: date("meeting_date"),
  authorEmail: text("author_email").notNull(),
  accessMode: accessModeEnum("access_mode").notNull().default("everyone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const noteAccess = pgTable(
  "note_access",
  {
    noteId: uuid("note_id")
      .notNull()
      .references(() => meetingNotes.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.userEmail] })],
);

export const meetingNoteTasks = pgTable("meeting_note_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  noteId: uuid("note_id")
    .notNull()
    .references(() => meetingNotes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  ownerEmail: text("owner_email"),
  endDate: date("end_date"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  promotedTaskId: uuid("promoted_task_id"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByEmail: text("created_by_email").notNull(),
});

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] })],
);

export const noteTags = pgTable(
  "note_tags",
  {
    noteId: uuid("note_id")
      .notNull()
      .references(() => meetingNotes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.tagId] })],
);

export const noteMentions = pgTable(
  "note_mentions",
  {
    noteId: uuid("note_id")
      .notNull()
      .references(() => meetingNotes.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.email] })],
);

export const notificationPrefs = pgTable("notification_prefs", {
  userEmail: text("user_email").primaryKey(),
  mentionsEmail: boolean("mentions_email").notNull().default(true),
  mentionsInApp: boolean("mentions_in_app").notNull().default(true),
  taskAssignEmail: boolean("task_assign_email").notNull().default(true),
  taskAssignInApp: boolean("task_assign_in_app").notNull().default(true),
  workspaceTaskAssignEmail: boolean("workspace_task_assign_email").notNull().default(true),
  workspaceTaskAssignInApp: boolean("workspace_task_assign_in_app").notNull().default(true),
  financeApprovalEmail: boolean("finance_approval_email").notNull().default(true),
  financeApprovalInApp: boolean("finance_approval_in_app").notNull().default(true),
  contentCalendarEmail: boolean("content_calendar_email").notNull().default(true),
  contentCalendarInApp: boolean("content_calendar_in_app").notNull().default(true),
  taskCompletedEmail: boolean("task_completed_email").notNull().default(true),
  taskCompletedInApp: boolean("task_completed_in_app").notNull().default(true),
  commentEmail: boolean("comment_email").notNull().default(true),
  commentInApp: boolean("comment_in_app").notNull().default(true),
  noteSharedEmail: boolean("note_shared_email").notNull().default(true),
  noteSharedInApp: boolean("note_shared_in_app").notNull().default(true),
  contentGoLiveEmail: boolean("content_go_live_email").notNull().default(true),
  contentGoLiveInApp: boolean("content_go_live_in_app").notNull().default(true),
  reviewEmail: boolean("review_email").notNull().default(true),
  reviewInApp: boolean("review_in_app").notNull().default(true),
  subscriptionEmail: boolean("subscription_email").notNull().default(true),
  subscriptionInApp: boolean("subscription_in_app").notNull().default(true),
  staleApprovalEmail: boolean("stale_approval_email").notNull().default(true),
  staleApprovalInApp: boolean("stale_approval_in_app").notNull().default(true),
  digestDailyEmail: boolean("digest_daily_email").notNull().default(true),
  digestDailyInApp: boolean("digest_daily_in_app").notNull().default(false),
  digestWeeklyEmail: boolean("digest_weekly_email").notNull().default(true),
  digestWeeklyInApp: boolean("digest_weekly_in_app").notNull().default(false),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipientEmail: text("recipient_email").notNull(),
  kind: text("kind").notNull(),
  noteId: uuid("note_id").references(() => meetingNotes.id, { onDelete: "cascade" }),
  taskId: uuid("task_id"),
  actorEmail: text("actor_email").notNull(),
  payload: jsonb("payload"),
  readAt: timestamp("read_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectLinks = pgTable("project_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByEmail: text("created_by_email").notNull(),
});

export const inboxTasks = pgTable("inbox_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  ownerEmail: text("owner_email").notNull(),
  completed: boolean("completed").notNull().default(false),
  endDate: date("end_date"),
  promotedTaskId: uuid("promoted_task_id"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByEmail: text("created_by_email").notNull(),
});

export const flipbooks = pgTable("flipbooks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  pageCount: integer("page_count").notNull(),
  pageWidth: integer("page_width").notNull(),
  pageHeight: integer("page_height").notNull(),
  sourcePdfUrl: text("source_pdf_url").notNull(),
  pageUrls: jsonb("page_urls").notNull(),
  settings: jsonb("settings").notNull(),
  overlays: jsonb("overlays").notNull().default([]),
  leadGate: jsonb("lead_gate"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flipbookLeads = pgTable("flipbook_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  flipbookId: text("flipbook_id")
    .notNull()
    .references(() => flipbooks.id, { onDelete: "cascade" }),
  cookieId: text("cookie_id").notNull(),
  email: text("email"),
  fields: jsonb("fields").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  hubspotSubmittedAt: timestamp("hubspot_submitted_at", { withTimezone: true }),
  hubspotError: text("hubspot_error"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type MeetingNote = typeof meetingNotes.$inferSelect;
export type NewMeetingNote = typeof meetingNotes.$inferInsert;
export type Flipbook = typeof flipbooks.$inferSelect;
export type NewFlipbook = typeof flipbooks.$inferInsert;
