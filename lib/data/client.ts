import type {
  Checklist,
  ChecklistUpdate,
  DemoSample,
  Mode,
  ProjectDetail,
  ProjectSummary,
  ReviewDetail,
  StartReviewInput,
} from "./types";

export type * from "./types";

/**
 * The one way screens read and write data (docs/10, "repository pattern").
 * DemoClient uses demo/data.json plus localStorage; LiveClient calls the API routes.
 */
export interface DataClient {
  mode: Mode;
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<ProjectDetail>;
  getReview(id: string): Promise<ReviewDetail>;
  startReview(input: StartReviewInput): Promise<{ reviewId: string }>;
  retryEvaluation(reviewId: string): Promise<void>;
  /** Live only: "Try again" on Review failed starts a new review of the stored screenshot. */
  restartReview?(reviewId: string): Promise<{ reviewId: string }>;
  /** Stops a running review and removes the version it created (docs/03 "Cancel review"). */
  cancelReview(reviewId: string): Promise<void>;
  setPushback(issueId: string, reason: string | null): Promise<void>;
  deleteProject(id: string): Promise<void>;
  getChecklist(): Promise<Checklist>;
  saveChecklist(update: ChecklistUpdate): Promise<void>;
  resetDemo?(): Promise<void>;
  /** Live only: tokens used by reviews this month, for the spend line on My checklist. */
  getUsage?(): Promise<{ input: number; output: number }>;
  /** Demo only: the sample screens for the New review picker. */
  listSamples?(): Promise<DemoSample[]>;
}

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} "${id}" was not found.`);
    this.name = "NotFoundError";
  }
}

/** A request the data source refuses, with a message that can be shown next to the field. */
export class ValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
