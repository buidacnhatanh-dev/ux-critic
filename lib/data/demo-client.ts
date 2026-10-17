import { applyChecklistUpdate } from "./checklist";
import { NotFoundError, ValidationError, type DataClient } from "./client";
import type { DemoData } from "./demo-schema";
import type {
  Checklist,
  ChecklistUpdate,
  DemoSample,
  Issue,
  Measurement,
  ProjectDetail,
  ProjectSummary,
  Pushback,
  ReviewDetail,
  ReviewStep,
  Severity,
  StartReviewInput,
  VersionSummary,
} from "./types";

/** localStorage key for the visitor's changes (docs/10). */
export const DEMO_STORAGE_KEY = "uxc-demo-v1";

/** Simulated step timing for a demo review, about 6 seconds in total (docs/10). */
export const SIMULATED_STEPS: [ReviewStep, number][] = [
  ["prepare", 800],
  ["measure", 1800],
  ["evaluate", 2600],
  ["place", 800],
];
export const SIMULATED_TOTAL_MS = SIMULATED_STEPS.reduce((sum, [, ms]) => sum + ms, 0);

type ProjectRow = DemoData["projects"][number];
type VersionRow = DemoData["versions"][number];
type ReviewRow = DemoData["reviews"][number];

/** A review the visitor started from a sample: it replays that sample's prepared review. */
type CreatedReview = {
  id: string;
  versionId: string;
  fromReviewId: string;
  startedAt: string;
  instant: boolean;
};

/** Everything the visitor changed, stored in localStorage. Prepared data is never modified. */
export type DemoOverlay = {
  v: 1;
  /** Issue id → reason. null removes a pushback that came with the prepared data. */
  pushbacks: Record<string, Pushback | null>;
  deletedProjectIds: string[];
  checklist: Checklist | null;
  created: { projects: ProjectRow[]; versions: VersionRow[]; reviews: CreatedReview[] };
};

export function emptyOverlay(): DemoOverlay {
  return {
    v: 1,
    pushbacks: {},
    deletedProjectIds: [],
    checklist: null,
    created: { projects: [], versions: [], reviews: [] },
  };
}

/** Reads a stored overlay. Anything unreadable or from another format version starts fresh. */
export function parseOverlay(raw: string | null): DemoOverlay {
  if (!raw) return emptyOverlay();
  try {
    const value = JSON.parse(raw) as Partial<DemoOverlay> | null;
    if (!value || value.v !== 1) return emptyOverlay();
    return {
      v: 1,
      pushbacks: isRecord(value.pushbacks) ? (value.pushbacks as DemoOverlay["pushbacks"]) : {},
      deletedProjectIds: Array.isArray(value.deletedProjectIds) ? value.deletedProjectIds : [],
      checklist: isRecord(value.checklist) ? (value.checklist as Checklist) : null,
      created: {
        projects: Array.isArray(value.created?.projects) ? value.created.projects : [],
        versions: Array.isArray(value.created?.versions) ? value.created.versions : [],
        reviews: Array.isArray(value.created?.reviews) ? value.created.reviews : [],
      },
    };
  } catch {
    return emptyOverlay();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Where a simulated review is after `elapsedMs`. */
export function simulatedProgress(elapsedMs: number): { step: ReviewStep; done: boolean } {
  let left = elapsedMs;
  for (const [step, ms] of SIMULATED_STEPS) {
    if (left < ms) return { step, done: false };
    left -= ms;
  }
  return { step: "place", done: true };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type DemoClientOptions = {
  storage?: StorageLike | null;
  now?: () => number;
  loadData?: () => Promise<DemoData>;
  newId?: () => string;
};

const loadBundledData = async () => (await import("@/demo/data.json")).default as DemoData;

function safeLocalStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Demo data source (docs/10): prepared sample reviews from demo/data.json plus the visitor's
 * changes from localStorage. Never calls the API, Claude or the database. If storage is blocked,
 * changes live in memory until reload.
 */
export class DemoClient implements DataClient {
  readonly mode = "demo" as const;
  private readonly storage: StorageLike | null;
  private readonly now: () => number;
  private readonly loadData: () => Promise<DemoData>;
  private readonly newId: () => string;
  private data: Promise<DemoData> | null = null;
  private overlay: DemoOverlay | null = null;

  constructor(options: DemoClientOptions = {}) {
    this.storage = options.storage === undefined ? safeLocalStorage() : options.storage;
    this.now = options.now ?? Date.now;
    this.loadData = options.loadData ?? loadBundledData;
    this.newId = options.newId ?? (() => crypto.randomUUID());
  }

  // Loading and saving

  private getData(): Promise<DemoData> {
    this.data ??= this.loadData();
    return this.data;
  }

  private getOverlay(): DemoOverlay {
    if (!this.overlay) {
      let raw: string | null = null;
      try {
        raw = this.storage?.getItem(DEMO_STORAGE_KEY) ?? null;
      } catch {
        // Storage blocked: start fresh, keep changes in memory.
      }
      this.overlay = parseOverlay(raw);
    }
    return this.overlay;
  }

  private save(overlay: DemoOverlay) {
    this.overlay = overlay;
    try {
      this.storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(overlay));
    } catch {
      // Storage blocked or full: changes last until reload.
    }
  }

  // Views that merge prepared data and the overlay

  private projectRows(data: DemoData, overlay: DemoOverlay): ProjectRow[] {
    return [...data.projects, ...overlay.created.projects].filter(
      (p) => !overlay.deletedProjectIds.includes(p.id),
    );
  }

  private versionRows(data: DemoData, overlay: DemoOverlay, projectId: string): VersionRow[] {
    return [...data.versions, ...overlay.created.versions]
      .filter((v) => v.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Latest review id of a version, prepared or created. */
  private reviewIdFor(data: DemoData, overlay: DemoOverlay, versionId: string): string | null {
    const created = overlay.created.reviews.filter((r) => r.versionId === versionId);
    if (created.length)
      return created.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]!.id;
    return data.reviews.find((r) => r.versionId === versionId)?.id ?? null;
  }

  private pushbackFor(data: DemoData, overlay: DemoOverlay, issueId: string): Pushback | null {
    if (issueId in overlay.pushbacks) return overlay.pushbacks[issueId] ?? null;
    const base = data.pushbacks.find((p) => p.issueId === issueId);
    return base ? { reason: base.reason, createdAt: base.createdAt } : null;
  }

  private buildReview(data: DemoData, overlay: DemoOverlay, reviewId: string) {
    const created = overlay.created.reviews.find((r) => r.id === reviewId);
    const baseId = created?.fromReviewId ?? reviewId;
    const base = data.reviews.find((r) => r.id === baseId);
    if (!base) return null;
    const versionId = created?.versionId ?? base.versionId;
    const version = [...data.versions, ...overlay.created.versions].find((v) => v.id === versionId);
    if (!version) return null;
    const project = this.projectRows(data, overlay).find((p) => p.id === version.projectId);
    if (!project) return null;

    // A created review copies the prepared one with its own ids, so pushbacks stay separate.
    const prefix = created ? `${created.id}:` : "";
    let measurements: Measurement[] = data.measurements
      .filter((m) => m.reviewId === base.id)
      .map(({ reviewId: _, ...m }) => ({ ...m, id: prefix + m.id }));
    let issues: Issue[] = data.issues
      .filter((i) => i.reviewId === base.id)
      .map(({ reviewId: _, ...i }) => ({
        ...i,
        id: prefix + i.id,
        measurementId: i.measurementId ? prefix + i.measurementId : null,
        pushback: null,
      }));
    issues = issues
      .map((i) => ({ ...i, pushback: this.pushbackFor(data, overlay, i.id) }))
      .sort((a, b) => a.number - b.number);

    let status: ReviewRow["status"] = base.status;
    let step: ReviewStep = base.step;
    let startedAt = base.startedAt;
    let finishedAt = base.finishedAt;
    if (created) {
      startedAt = created.startedAt;
      const elapsed = created.instant ? Infinity : this.now() - Date.parse(created.startedAt);
      const progress = simulatedProgress(elapsed);
      step = progress.step;
      status = progress.done ? base.status : "running";
      finishedAt = progress.done
        ? new Date(
            Date.parse(created.startedAt) + (created.instant ? 0 : SIMULATED_TOTAL_MS),
          ).toISOString()
        : null;
      if (!progress.done) {
        // Measured results exist once measuring is over; evaluated ones only at the end.
        const measured = step === "evaluate" || step === "place";
        measurements = measured ? measurements : [];
        issues = measured ? issues.filter((i) => i.kind === "measured") : [];
      }
    }

    return {
      base,
      created,
      version,
      project,
      issues,
      measurements,
      status,
      step,
      startedAt,
      finishedAt,
    };
  }

  private versionSummary(
    data: DemoData,
    overlay: DemoOverlay,
    version: VersionRow,
  ): VersionSummary {
    const reviewId = this.reviewIdFor(data, overlay, version.id);
    const review = reviewId ? this.buildReview(data, overlay, reviewId) : null;
    return {
      id: version.id,
      name: version.name,
      createdAt: version.createdAt,
      screenshotUrl: version.screenshotUrl,
      width: version.width,
      height: version.height,
      scale: version.scale,
      reviewId,
      reviewStatus: review?.status ?? null,
      issueCount: review?.issues.length ?? 0,
      pushbackCount: review?.issues.filter((i) => i.pushback).length ?? 0,
    };
  }

  // DataClient

  listSamples = async (): Promise<DemoSample[]> => {
    const data = await this.getData();
    return data.samples.map(({ reviewId: _, ...sample }) => sample);
  };

  listProjects = async (): Promise<ProjectSummary[]> => {
    const data = await this.getData();
    const overlay = this.getOverlay();
    const summaries = this.projectRows(data, overlay).map((project) => {
      const versions = this.versionRows(data, overlay, project.id);
      const [latest, previous] = versions;
      const latestReview = latest
        ? this.buildReview(data, overlay, this.reviewIdFor(data, overlay, latest.id) ?? "")
        : null;
      const finished = latestReview && latestReview.status !== "running" ? latestReview : null;
      const counts: Record<Severity, number> | null = finished
        ? {
            high: finished.issues.filter((i) => i.severity === "high").length,
            medium: finished.issues.filter((i) => i.severity === "medium").length,
            low: finished.issues.filter((i) => i.severity === "low").length,
          }
        : null;
      const previousReviewId = previous ? this.reviewIdFor(data, overlay, previous.id) : null;
      const previousReview = previousReviewId
        ? this.buildReview(data, overlay, previousReviewId)
        : null;
      return {
        summary: {
          id: project.id,
          name: project.name,
          latestVersion: latest
            ? {
                id: latest.id,
                name: latest.name,
                reviewedAt: finished?.finishedAt ?? null,
                thumbnailUrl: latest.screenshotUrl,
              }
            : null,
          counts,
          previousIssueCount:
            previousReview && previousReview.status !== "running"
              ? previousReview.issues.length
              : null,
          versionCount: versions.length,
        } satisfies ProjectSummary,
        activity: latest?.createdAt ?? project.createdAt,
      };
    });
    return summaries.sort((a, b) => b.activity.localeCompare(a.activity)).map((s) => s.summary);
  };

  getProject = async (id: string): Promise<ProjectDetail> => {
    const data = await this.getData();
    const overlay = this.getOverlay();
    const project = this.projectRows(data, overlay).find((p) => p.id === id);
    if (!project) throw new NotFoundError("Project", id);
    return {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      versions: this.versionRows(data, overlay, id).map((v) =>
        this.versionSummary(data, overlay, v),
      ),
    };
  };

  getReview = async (id: string): Promise<ReviewDetail> => {
    const data = await this.getData();
    const overlay = this.getOverlay();
    const built = this.buildReview(data, overlay, id);
    if (!built) throw new NotFoundError("Review", id);
    const { base, version, project } = built;
    return {
      id,
      projectId: project.id,
      projectName: project.name,
      version: this.versionSummary(data, overlay, version),
      status: built.status,
      step: built.step,
      error: base.error,
      sources: base.sources,
      model: base.model,
      inputTokens: base.inputTokens,
      outputTokens: base.outputTokens,
      startedAt: built.startedAt,
      finishedAt: built.finishedAt,
      issues: built.issues,
      measurements: built.measurements,
      source: base.source,
      sampleId: version.sampleId,
    };
  };

  startReview = async (input: StartReviewInput): Promise<{ reviewId: string }> => {
    if (input.mode !== "demo")
      throw new ValidationError("file", "The demo reviews sample screens only.");
    const data = await this.getData();
    const overlay = structuredClone(this.getOverlay());
    const sample = data.samples.find((s) => s.id === input.sampleId);
    if (!sample) throw new ValidationError("sample", "Pick a sample screen.");

    const nowIso = new Date(this.now()).toISOString();
    let projectId = input.projectId;
    if (projectId) {
      if (!this.projectRows(data, overlay).some((p) => p.id === projectId)) {
        throw new NotFoundError("Project", projectId);
      }
    } else {
      const name = input.newProjectName?.trim() ?? "";
      if (!name) throw new ValidationError("project", "Give the new project a name.");
      const taken = this.projectRows(data, overlay).some(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (taken) throw new ValidationError("project", `A project called "${name}" already exists.`);
      projectId = `project-${this.newId()}`;
      overlay.created.projects.push({ id: projectId, name, createdAt: nowIso });
    }

    const versionName = input.versionName.trim();
    if (!versionName) throw new ValidationError("version", "Give the version a name, like v1.");
    const versions = this.versionRows(data, overlay, projectId);
    if (versions.some((v) => v.name.toLowerCase() === versionName.toLowerCase())) {
      throw new ValidationError("version", `"${versionName}" already exists in this project.`);
    }

    const versionId = `version-${this.newId()}`;
    overlay.created.versions.push({
      id: versionId,
      projectId,
      sampleId: sample.id,
      name: versionName,
      context: input.context.trim(),
      screenshotUrl: sample.screenshotUrl,
      width: sample.width,
      height: sample.height,
      scale: sample.scale,
      createdAt: nowIso,
    });
    const reviewId = `review-${this.newId()}`;
    overlay.created.reviews.push({
      id: reviewId,
      versionId,
      fromReviewId: sample.reviewId,
      startedAt: nowIso,
      instant: Boolean(input.instant),
    });
    this.save(overlay);
    return { reviewId };
  };

  retryEvaluation = async (): Promise<void> => {
    throw new Error("Demo reviews are prepared in advance, so there is nothing to retry.");
  };

  setPushback = async (issueId: string, reason: string | null): Promise<void> => {
    const data = await this.getData();
    const overlay = structuredClone(this.getOverlay());
    const reviewIds = [
      ...data.reviews.map((r) => r.id),
      ...overlay.created.reviews.map((r) => r.id),
    ];
    const exists = reviewIds.some((id) =>
      this.buildReview(data, overlay, id)?.issues.some((i) => i.id === issueId),
    );
    if (!exists) throw new NotFoundError("Issue", issueId);
    if (reason === null) {
      overlay.pushbacks[issueId] = null;
    } else {
      const trimmed = reason.trim();
      if (!trimmed) throw new ValidationError("reason", "Say why you disagree.");
      overlay.pushbacks[issueId] = {
        reason: trimmed,
        createdAt: new Date(this.now()).toISOString(),
      };
    }
    this.save(overlay);
  };

  deleteProject = async (id: string): Promise<void> => {
    const data = await this.getData();
    const overlay = structuredClone(this.getOverlay());
    if (overlay.created.projects.some((p) => p.id === id)) {
      const versionIds = overlay.created.versions
        .filter((v) => v.projectId === id)
        .map((v) => v.id);
      overlay.created.projects = overlay.created.projects.filter((p) => p.id !== id);
      overlay.created.versions = overlay.created.versions.filter((v) => v.projectId !== id);
      overlay.created.reviews = overlay.created.reviews.filter(
        (r) => !versionIds.includes(r.versionId),
      );
    } else if (data.projects.some((p) => p.id === id) && !overlay.deletedProjectIds.includes(id)) {
      overlay.deletedProjectIds.push(id);
      // Reviews the visitor added to a prepared project go with it.
      const versionIds = overlay.created.versions
        .filter((v) => v.projectId === id)
        .map((v) => v.id);
      overlay.created.versions = overlay.created.versions.filter((v) => v.projectId !== id);
      overlay.created.reviews = overlay.created.reviews.filter(
        (r) => !versionIds.includes(r.versionId),
      );
    } else {
      throw new NotFoundError("Project", id);
    }
    this.save(overlay);
  };

  getChecklist = async (): Promise<Checklist> => {
    const data = await this.getData();
    const overlay = this.getOverlay();
    return overlay.checklist ?? { sources: data.settings.sources, rules: data.rules };
  };

  saveChecklist = async (update: ChecklistUpdate): Promise<void> => {
    const current = await this.getChecklist();
    const overlay = structuredClone(this.getOverlay());
    overlay.checklist = applyChecklistUpdate(current, update, this.newId);
    this.save(overlay);
  };

  /** Clears the visitor's changes and brings back the sample projects. */
  resetDemo = async (): Promise<void> => {
    this.overlay = emptyOverlay();
    try {
      this.storage?.removeItem(DEMO_STORAGE_KEY);
    } catch {
      // Storage blocked: the in-memory changes are gone already.
    }
  };
}
