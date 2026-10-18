/**
 * Live data access for the API routes: rows from docs/02 in, the shared DataClient types out.
 * Server only. Every function takes the database so tests can use an in-memory one.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { applyChecklistUpdate } from "../data/checklist.ts";
import { NotFoundError, ValidationError } from "../data/client.ts";
import type {
  Checklist,
  ChecklistUpdate,
  Issue,
  Measurement,
  ProjectDetail,
  ProjectSummary,
  ReviewDetail,
  Rule,
  Scale,
  Severity,
  SeverityCounts,
  SourceSettings,
  VersionSummary,
} from "../data/types.ts";
import type { Db } from "./client.ts";
import { readBox, readError, readJson, reviewSourcesSchema, sourceSettingsSchema } from "./json.ts";
import * as t from "./schema.ts";
import { DEFAULT_SOURCES } from "./seed.ts";

type VersionRow = typeof t.versions.$inferSelect;
type ReviewRow = typeof t.reviews.$inferSelect;
type IssueRow = typeof t.issues.$inferSelect;

export const screenshotUrl = (versionId: string) => `/api/screenshots/${versionId}`;

const now = () => new Date().toISOString();

// Reading

function counts(rows: Pick<IssueRow, "severity">[]): SeverityCounts {
  const result: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const row of rows) result[row.severity]++;
  return result;
}

const isFinished = (status: ReviewRow["status"]) =>
  status === "done" || status === "partial" || status === "failed";

/** The latest review of each version (one per version in v1, more after Try again). */
function latestReviews(db: Db, versionIds: string[]): Map<string, ReviewRow> {
  const map = new Map<string, ReviewRow>();
  if (versionIds.length === 0) return map;
  const rows = db
    .select()
    .from(t.reviews)
    .where(inArray(t.reviews.versionId, versionIds))
    .orderBy(asc(t.reviews.startedAt), sql`rowid`)
    .all();
  for (const row of rows) map.set(row.versionId, row);
  return map;
}

function issuesOf(db: Db, reviewIds: string[]) {
  if (reviewIds.length === 0) return [];
  return db
    .select({
      issue: t.issues,
      pushback: t.pushbacks,
    })
    .from(t.issues)
    .leftJoin(t.pushbacks, eq(t.pushbacks.issueId, t.issues.id))
    .where(inArray(t.issues.reviewId, reviewIds))
    .orderBy(asc(t.issues.number))
    .all();
}

function versionSummaries(db: Db, rows: VersionRow[]): VersionSummary[] {
  const reviews = latestReviews(
    db,
    rows.map((v) => v.id),
  );
  const reviewIds = [...reviews.values()].map((r) => r.id);
  const issueRows = issuesOf(db, reviewIds);
  return rows.map((version) => {
    const review = reviews.get(version.id) ?? null;
    const own = review ? issueRows.filter((r) => r.issue.reviewId === review.id) : [];
    const finished = review && isFinished(review.status) ? review : null;
    return {
      id: version.id,
      name: version.name,
      context: version.context,
      createdAt: version.createdAt,
      screenshotUrl: screenshotUrl(version.id),
      width: version.width,
      height: version.height,
      scale: version.scale as Scale,
      reviewId: review?.id ?? null,
      reviewStatus: review?.status ?? null,
      reviewedAt: finished?.finishedAt ?? null,
      counts: finished ? counts(own.map((r) => r.issue)) : null,
      issueCount: own.length,
      pushbackCount: own.filter((r) => r.pushback).length,
    };
  });
}

function versionsOfProject(db: Db, projectId: string): VersionRow[] {
  return db
    .select()
    .from(t.versions)
    .where(eq(t.versions.projectId, projectId))
    .orderBy(desc(t.versions.createdAt), sql`rowid desc`)
    .all();
}

export function listProjects(db: Db): ProjectSummary[] {
  const projects = db.select().from(t.projects).all();
  return projects
    .map((project) => {
      const versions = versionSummaries(db, versionsOfProject(db, project.id));
      const [latest, previous] = versions;
      const previousFinished = previous && previous.counts ? previous : null;
      return {
        summary: {
          id: project.id,
          name: project.name,
          latestVersion: latest
            ? {
                id: latest.id,
                name: latest.name,
                reviewedAt: latest.reviewedAt,
                thumbnailUrl: latest.screenshotUrl,
              }
            : null,
          counts: latest?.counts ?? null,
          previousIssueCount: previousFinished ? previousFinished.issueCount : null,
          previousVersionName: previous?.name ?? null,
          versionCount: versions.length,
        } satisfies ProjectSummary,
        activity: latest?.createdAt ?? project.createdAt,
      };
    })
    .sort((a, b) => b.activity.localeCompare(a.activity))
    .map((p) => p.summary);
}

export function getProject(db: Db, id: string): ProjectDetail {
  const project = db.select().from(t.projects).where(eq(t.projects.id, id)).get();
  if (!project) throw new NotFoundError("Project", id);
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    versions: versionSummaries(db, versionsOfProject(db, id)),
  };
}

export function getReview(db: Db, id: string): ReviewDetail {
  const review = db.select().from(t.reviews).where(eq(t.reviews.id, id)).get();
  if (!review) throw new NotFoundError("Review", id);
  const version = db.select().from(t.versions).where(eq(t.versions.id, review.versionId)).get();
  if (!version) throw new NotFoundError("Review", id);
  const project = db.select().from(t.projects).where(eq(t.projects.id, version.projectId)).get();
  if (!project) throw new NotFoundError("Review", id);

  const sources = readJson(reviewSourcesSchema, review.sources);
  const issues: Issue[] = issuesOf(db, [review.id]).map(({ issue, pushback }) => ({
    id: issue.id,
    number: issue.number,
    kind: issue.kind,
    principleId: issue.principleId,
    title: issue.title,
    detail: issue.detail,
    fix: issue.fix,
    severity: issue.severity,
    confidence: issue.confidence,
    measurementId: issue.measurementId,
    region: readBox(issue.region),
    pushback: pushback ? { reason: pushback.reason, createdAt: pushback.createdAt } : null,
  }));
  const measurements: Measurement[] = db
    .select()
    .from(t.measurements)
    .where(eq(t.measurements.reviewId, review.id))
    .orderBy(sql`rowid`)
    .all()
    .map((m) => ({
      id: m.id,
      kind: m.kind,
      label: m.label,
      box: readBox(m.box)!,
      value: m.value,
      threshold: m.threshold,
      passes: m.passes === 1,
    }));

  // The version summary describes this review, not a newer retry of the same version.
  const [summary] = versionSummaries(db, [version]);
  return {
    id: review.id,
    projectId: project.id,
    projectName: project.name,
    version: summary!,
    status: review.status,
    step: review.step,
    error: readError(review.error),
    sources: { sets: sources.sets, ruleIds: sources.ruleIds },
    evaluationOff: !sources.evaluation,
    model: review.model,
    inputTokens: review.inputTokens,
    outputTokens: review.outputTokens,
    startedAt: review.startedAt,
    finishedAt: review.finishedAt,
    issues,
    measurements,
  };
}

/** What the pipeline needs to run a review. */
export function getReviewJob(db: Db, reviewId: string) {
  const row = db
    .select({ review: t.reviews, version: t.versions })
    .from(t.reviews)
    .innerJoin(t.versions, eq(t.versions.id, t.reviews.versionId))
    .where(eq(t.reviews.id, reviewId))
    .get();
  if (!row) throw new NotFoundError("Review", reviewId);
  return {
    review: row.review,
    version: row.version,
    sources: readJson(reviewSourcesSchema, row.review.sources),
  };
}

// Checklist

export function getChecklist(db: Db): Checklist {
  const stored = db.select().from(t.settings).where(eq(t.settings.key, "sources")).get();
  const sources = stored ? readJson(sourceSettingsSchema, stored.value) : DEFAULT_SOURCES;
  const rules: Rule[] = db
    .select()
    .from(t.rules)
    .orderBy(asc(t.rules.position))
    .all()
    .map((r) => ({ ...r, enabled: r.enabled === 1 }));
  return { sources, rules };
}

export function saveChecklist(
  db: Db,
  update: ChecklistUpdate,
  newId: () => string = () => crypto.randomUUID(),
): void {
  db.transaction((tx) => {
    const current = getChecklist(tx as unknown as Db);
    let next: Checklist;
    try {
      next = applyChecklistUpdate(current, update, newId);
    } catch (error) {
      throw new ValidationError("text", error instanceof Error ? error.message : String(error));
    }
    tx.insert(t.settings)
      .values({ key: "sources", value: JSON.stringify(next.sources) })
      .onConflictDoUpdate({ target: t.settings.key, set: { value: JSON.stringify(next.sources) } })
      .run();
    tx.delete(t.rules).run();
    if (next.rules.length) {
      tx.insert(t.rules)
        .values(next.rules.map((r) => ({ ...r, enabled: r.enabled ? 1 : 0 })))
        .run();
    }
  });
}

// Writing

export type CreateReviewInput = {
  projectId: string | null;
  newProjectName: string | null;
  versionName: string;
  context: string;
  scale: Scale;
  fileName: string;
  width: number;
  height: number;
  sources: SourceSettings;
  /** False when Claude is not connected and the owner chose measured checks only. */
  evaluation: boolean;
};

/** Enabled rule ids at the start of a review, stored with it (docs/02 reviews.sources). */
function enabledRuleIds(db: Db): string[] {
  return getChecklist(db)
    .rules.filter((r) => r.enabled)
    .map((r) => r.id);
}

/**
 * Creates the project (when new), the version and a queued review in one transaction. The caller
 * writes the screenshot to `screenshotPath` (data/screenshots/<version id>.png).
 */
export function createReview(
  db: Db,
  input: CreateReviewInput,
  screenshotPathFor: (versionId: string) => string,
  newId: () => string = () => crypto.randomUUID(),
): { projectId: string; versionId: string; reviewId: string; screenshotPath: string } {
  return db.transaction((tx) => {
    const createdAt = now();
    let projectId = input.projectId;
    if (projectId) {
      const exists = tx.select().from(t.projects).where(eq(t.projects.id, projectId)).get();
      if (!exists) throw new NotFoundError("Project", projectId);
    } else {
      const name = input.newProjectName?.trim() ?? "";
      if (!name) throw new ValidationError("project", "Give the new project a name.");
      const taken = tx
        .select()
        .from(t.projects)
        .where(sql`lower(${t.projects.name}) = lower(${name})`)
        .get();
      if (taken) throw new ValidationError("project", `A project called "${name}" already exists.`);
      projectId = newId();
      tx.insert(t.projects).values({ id: projectId, name, createdAt }).run();
    }

    const versionName = input.versionName.trim();
    if (!versionName) throw new ValidationError("version", "Give the version a name, like v1.");
    const usedName = tx
      .select()
      .from(t.versions)
      .where(
        and(
          eq(t.versions.projectId, projectId),
          sql`lower(${t.versions.name}) = lower(${versionName})`,
        ),
      )
      .get();
    if (usedName) {
      throw new ValidationError("version", `"${versionName}" already exists in this project.`);
    }

    const versionId = newId();
    const screenshotPath = screenshotPathFor(versionId);
    tx.insert(t.versions)
      .values({
        id: versionId,
        projectId,
        name: versionName,
        context: input.context.trim(),
        screenshotPath,
        fileName: input.fileName,
        width: input.width,
        height: input.height,
        scale: input.scale,
        createdAt,
      })
      .run();

    const reviewId = newId();
    tx.insert(t.reviews)
      .values({
        id: reviewId,
        versionId,
        status: "queued",
        step: "prepare",
        sources: JSON.stringify({
          sets: input.sources,
          ruleIds: enabledRuleIds(tx as unknown as Db),
          evaluation: input.evaluation,
        }),
        // Written by the pipeline from the API response: the model that actually answered.
        model: null,
        startedAt: createdAt,
      })
      .run();
    return { projectId, versionId, reviewId, screenshotPath };
  });
}

/** "Try again" on Review failed: a new review of the same version and stored screenshot. */
export function restartReview(
  db: Db,
  reviewId: string,
  options: { evaluation: boolean },
  newId: () => string = () => crypto.randomUUID(),
): string {
  const old = db.select().from(t.reviews).where(eq(t.reviews.id, reviewId)).get();
  if (!old) throw new NotFoundError("Review", reviewId);
  if (old.status !== "failed") {
    throw new ValidationError("review", "Only a review that didn't finish can be started again.");
  }
  const { sets } = readJson(reviewSourcesSchema, old.sources);
  const id = newId();
  db.insert(t.reviews)
    .values({
      id,
      versionId: old.versionId,
      status: "queued",
      step: "prepare",
      sources: JSON.stringify({
        sets,
        ruleIds: enabledRuleIds(db),
        evaluation: options.evaluation,
      }),
      model: null,
      startedAt: now(),
    })
    .run();
  return id;
}

/**
 * "Cancel review": removes the version the review created, and its project when nothing else is
 * left in it. Returns the screenshot paths to delete from disk.
 */
export function cancelReview(db: Db, reviewId: string): string[] {
  return db.transaction((tx) => {
    const row = tx
      .select({ review: t.reviews, version: t.versions })
      .from(t.reviews)
      .innerJoin(t.versions, eq(t.versions.id, t.reviews.versionId))
      .where(eq(t.reviews.id, reviewId))
      .get();
    if (!row) throw new NotFoundError("Review", reviewId);
    if (row.review.status !== "queued" && row.review.status !== "running") {
      throw new ValidationError("review", "This review has already finished.");
    }
    tx.delete(t.versions).where(eq(t.versions.id, row.version.id)).run();
    const left = tx
      .select({ id: t.versions.id })
      .from(t.versions)
      .where(eq(t.versions.projectId, row.version.projectId))
      .all();
    if (left.length === 0)
      tx.delete(t.projects).where(eq(t.projects.id, row.version.projectId)).run();
    return [row.version.screenshotPath];
  });
}

/** Deletes a project with its versions, reviews and notes. Returns screenshot paths to remove. */
export function deleteProject(db: Db, id: string): string[] {
  return db.transaction((tx) => {
    const project = tx.select().from(t.projects).where(eq(t.projects.id, id)).get();
    if (!project) throw new NotFoundError("Project", id);
    const paths = tx
      .select({ path: t.versions.screenshotPath })
      .from(t.versions)
      .where(eq(t.versions.projectId, id))
      .all()
      .map((v) => v.path);
    tx.delete(t.projects).where(eq(t.projects.id, id)).run();
    return paths;
  });
}

export function setPushback(db: Db, issueId: string, reason: string | null): void {
  const issue = db.select().from(t.issues).where(eq(t.issues.id, issueId)).get();
  if (!issue) throw new NotFoundError("Issue", issueId);
  if (reason === null) {
    db.delete(t.pushbacks).where(eq(t.pushbacks.issueId, issueId)).run();
    return;
  }
  const trimmed = reason.trim();
  if (!trimmed) throw new ValidationError("reason", "Say why you disagree.");
  db.insert(t.pushbacks)
    .values({ issueId, reason: trimmed, createdAt: now() })
    .onConflictDoUpdate({ target: t.pushbacks.issueId, set: { reason: trimmed, createdAt: now() } })
    .run();
}

/** Token usage of every review started since `since` (the spend line on My checklist). */
export function tokenUsageSince(db: Db, since: string): { input: number; output: number } {
  const row = db
    .select({
      input: sql<number>`coalesce(sum(${t.reviews.inputTokens}), 0)`,
      output: sql<number>`coalesce(sum(${t.reviews.outputTokens}), 0)`,
    })
    .from(t.reviews)
    .where(sql`${t.reviews.startedAt} >= ${since}`)
    .get();
  return { input: row?.input ?? 0, output: row?.output ?? 0 };
}
