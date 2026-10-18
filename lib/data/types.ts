/** Shared data types for both clients (docs/02-data-model.md, docs/10-demo-mode.md). */

export type Mode = "demo" | "live";
export type Severity = "high" | "medium" | "low";
export type IssueKind = "measured" | "evaluated";
export type Confidence = "high" | "medium" | "low";
export type ReviewStatus = "queued" | "running" | "done" | "partial" | "failed";
export type ReviewStep = "prepare" | "measure" | "evaluate" | "place";
export type MeasurementKind = "contrast" | "text_size" | "target_size";
export type RuleMetric = "target_size_min" | "text_size_min" | "contrast_min";
export type Scale = 1 | 2 | 3;

/** Box in original image pixels. */
export type Box = { x: number; y: number; w: number; h: number };

/** Where a demo review came from (docs/10). */
export type ReviewSource = { kind: "handwritten" } | { kind: "claude"; generatedAt: string };

export type SeverityCounts = Record<Severity, number>;

export type ProjectSummary = {
  id: string;
  name: string;
  latestVersion: {
    id: string;
    name: string;
    reviewedAt: string | null;
    thumbnailUrl: string;
  } | null;
  counts: SeverityCounts | null;
  /** Issue count of the previous version, for the trend line. Null with one version. */
  previousIssueCount: number | null;
  /** Name of the previous version ("v1"), for the trend line. Null with one version. */
  previousVersionName: string | null;
  versionCount: number;
};

export type VersionSummary = {
  id: string;
  name: string;
  /** The "What is this screen for?" answer, may be empty. */
  context: string;
  createdAt: string;
  screenshotUrl: string;
  width: number;
  height: number;
  scale: Scale;
  reviewId: string | null;
  reviewStatus: ReviewStatus | null;
  /** When the latest review finished. Null while it runs or when there is none. */
  reviewedAt: string | null;
  /** Severity counts of the latest finished review. Null while it runs or when there is none. */
  counts: SeverityCounts | null;
  issueCount: number;
  pushbackCount: number;
};

export type ProjectDetail = {
  id: string;
  name: string;
  createdAt: string;
  versions: VersionSummary[];
};

export type Measurement = {
  id: string;
  kind: MeasurementKind;
  label: string;
  box: Box;
  value: number;
  threshold: number;
  passes: boolean;
};

export type Pushback = { reason: string; createdAt: string };

export type Issue = {
  id: string;
  number: number;
  kind: IssueKind;
  principleId: string;
  title: string;
  detail: string;
  fix: string;
  severity: Severity;
  confidence: Confidence | null;
  measurementId: string | null;
  region: Box | null;
  pushback: Pushback | null;
};

/**
 * A measured check that did not run in a live review (docs/03). Target sizes need Claude call 1 to
 * find the controls; text checks need OCR.
 */
export type SkippedCheck = {
  check: "target_size" | "text";
  /** `no_claude`: measured checks only, no key. `failed`: the step failed, the rest went on. */
  reason: "no_claude" | "failed";
  /** Technical detail for a failure. */
  detail: string | null;
};

export type SourceSettings = { nielsen: boolean; wcag: boolean; laws: boolean; mine: boolean };

export type ReviewDetail = {
  id: string;
  projectId: string;
  projectName: string;
  version: VersionSummary;
  status: ReviewStatus;
  step: ReviewStep;
  error: { message: string; detail: string | null } | null;
  sources: { sets: SourceSettings; ruleIds: string[] };
  /** Live only: true when the review ran without Claude (measured checks only, docs/03). */
  evaluationOff?: boolean;
  /** Live only: measured checks that did not run, and why. */
  skippedChecks?: SkippedCheck[];
  /** Null for reviews that were not made by a model (handwritten demo reviews). */
  model: string | null;
  /** From the API usage. Null when no API call was made. */
  inputTokens: number | null;
  outputTokens: number | null;
  startedAt: string;
  finishedAt: string | null;
  issues: Issue[];
  measurements: Measurement[];
  /** Demo only: where the prepared review came from. */
  source?: ReviewSource;
  /** Demo only: the sample screen this review belongs to. */
  sampleId?: string;
};

export type StartReviewInput =
  | {
      mode: "live";
      projectId: string | null;
      newProjectName: string | null;
      versionName: string;
      context: string;
      scale: Scale;
      file: File;
      sources: SourceSettings;
    }
  | {
      mode: "demo";
      projectId: string | null;
      newProjectName: string | null;
      versionName: string;
      context: string;
      sampleId: string;
      /** Skip the simulated step timing (reduced motion). */
      instant?: boolean;
    };

export type Rule = {
  id: string;
  text: string;
  kind: IssueKind;
  metric: RuleMetric | null;
  threshold: number | null;
  position: number;
  enabled: boolean;
};

export type Checklist = {
  sources: SourceSettings;
  rules: Rule[];
};

export type ChecklistUpdate =
  | { type: "sources"; sources: SourceSettings }
  | { type: "createRule"; rule: Omit<Rule, "id" | "position"> }
  | { type: "updateRule"; rule: Rule }
  | { type: "deleteRule"; ruleId: string }
  /** Undo of a delete: puts the rule back with its id at its old position. */
  | { type: "restoreRule"; rule: Rule }
  | { type: "moveRule"; ruleId: string; direction: "up" | "down" };

/** A demo sample screen for the New review picker (docs/10). */
export type DemoSample = {
  id: string;
  name: string;
  screenshotUrl: string;
  width: number;
  height: number;
  scale: Scale;
};
