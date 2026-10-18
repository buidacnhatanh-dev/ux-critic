/** SQLite tables (docs/02-data-model.md). Ids are text UUIDs, times ISO strings, JSON is text. */
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  // Names are unique without regard to case, as the New review form checks them.
  (t) => [uniqueIndex("projects_name_unique").on(sql`lower(${t.name})`)],
);

export const versions = sqliteTable(
  "versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    context: text("context").notNull().default(""),
    screenshotPath: text("screenshot_path").notNull(),
    /** Name of the uploaded file. Fake AI mode picks its fixture by it (docs/03). */
    fileName: text("file_name").notNull().default(""),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    scale: integer("scale").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("versions_project_name_unique").on(t.projectId, sql`lower(${t.name})`)],
);

export const REVIEW_STATUSES = ["queued", "running", "done", "partial", "failed"] as const;
export const REVIEW_STEPS = ["prepare", "measure", "evaluate", "place"] as const;

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  versionId: text("version_id")
    .notNull()
    .references(() => versions.id, { onDelete: "cascade" }),
  status: text("status", { enum: REVIEW_STATUSES }).notNull(),
  step: text("step", { enum: REVIEW_STEPS }).notNull(),
  /** JSON `{message, detail}`: a short message for Review failed plus technical detail. */
  error: text("error"),
  /** JSON: which principle sets and rule ids were on, and whether evaluation ran. */
  sources: text("sources").notNull(),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
});

export const measurements = sqliteTable("measurements", {
  id: text("id").primaryKey(),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["contrast", "text_size", "target_size"] }).notNull(),
  label: text("label").notNull(),
  /** JSON `{x,y,w,h}` in original image pixels. */
  box: text("box").notNull(),
  value: real("value").notNull(),
  threshold: real("threshold").notNull(),
  passes: integer("passes").notNull(),
});

export const issues = sqliteTable("issues", {
  id: text("id").primaryKey(),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  kind: text("kind", { enum: ["measured", "evaluated"] }).notNull(),
  principleId: text("principle_id").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  fix: text("fix").notNull(),
  severity: text("severity", { enum: ["high", "medium", "low"] }).notNull(),
  confidence: text("confidence", { enum: ["high", "medium", "low"] }),
  measurementId: text("measurement_id"),
  /** JSON `{x,y,w,h}` in original pixels, null means the whole screen. */
  region: text("region"),
});

export const pushbacks = sqliteTable("pushbacks", {
  issueId: text("issue_id")
    .primaryKey()
    .references(() => issues.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});

export const rules = sqliteTable("rules", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  kind: text("kind", { enum: ["measured", "evaluated"] }).notNull(),
  metric: text("metric", { enum: ["target_size_min", "text_size_min", "contrast_min"] }),
  threshold: real("threshold"),
  position: integer("position").notNull(),
  enabled: integer("enabled").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
