import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  boolean,
  real,
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
export const taskStatusEnum = pgEnum("task_status", ["todo", "doing", "blocked", "done"]);
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
  status: taskStatusEnum("status").notNull().default("todo"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  goal: text("goal"),
  expectedOutcome: text("expected_outcome"),
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

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
