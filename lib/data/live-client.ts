import { NotFoundError, ValidationError, type DataClient } from "./client";
import type {
  Checklist,
  ChecklistUpdate,
  ProjectDetail,
  ProjectSummary,
  ReviewDetail,
  StartReviewInput,
} from "./types";

type Fetch = typeof fetch;

/** Tokens used by live reviews this month (the spend line on My checklist). */
export type Usage = { input: number; output: number };

/**
 * Live data source (docs/10): calls the API routes from docs/01, which use SQLite and the pipeline
 * on the server. It never imports the database or the pipeline itself, and never talks to Claude.
 */
export class LiveClient implements DataClient {
  readonly mode = "live" as const;

  constructor(private readonly fetcher: Fetch = (...args) => fetch(...args)) {}

  private async request<T>(path: string, init: RequestInit = {}, what = "Item"): Promise<T> {
    const response = await this.fetcher(path, { cache: "no-store", ...init });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }
    if (response.ok) return data as T;
    const body = (data ?? {}) as { field?: string; message?: string };
    if (response.status === 404) throw new NotFoundError(what, path.split("/").at(-1) ?? path);
    if (response.status === 400 && body.field)
      throw new ValidationError(body.field, body.message ?? "");
    throw new Error(body.message || `The server answered ${response.status}.`);
  }

  private send<T>(method: string, path: string, json?: unknown, what?: string): Promise<T> {
    return this.request<T>(
      path,
      json === undefined
        ? { method }
        : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(json) },
      what,
    );
  }

  listProjects = () => this.request<ProjectSummary[]>("/api/projects");

  getProject = (id: string) =>
    this.request<ProjectDetail>(`/api/projects/${encodeURIComponent(id)}`, {}, "Project");

  getReview = (id: string) =>
    this.request<ReviewDetail>(`/api/reviews/${encodeURIComponent(id)}`, {}, "Review");

  startReview = (input: StartReviewInput) => {
    if (input.mode !== "live") {
      return Promise.reject(
        new ValidationError("sample", "Live mode reviews uploaded screenshots."),
      );
    }
    const form = new FormData();
    form.set("file", input.file, input.file.name);
    if (input.projectId) form.set("projectId", input.projectId);
    if (input.newProjectName) form.set("newProjectName", input.newProjectName);
    form.set("versionName", input.versionName);
    form.set("context", input.context);
    form.set("scale", String(input.scale));
    form.set("sources", JSON.stringify(input.sources));
    return this.request<{ reviewId: string }>("/api/reviews", { method: "POST", body: form });
  };

  /** "Try again" on Review failed: a new review of the same stored screenshot. */
  restartReview = (reviewId: string) =>
    this.send<{ reviewId: string }>("POST", "/api/reviews", { retryOf: reviewId }, "Review");

  retryEvaluation = async (reviewId: string) => {
    await this.send(
      "POST",
      `/api/reviews/${encodeURIComponent(reviewId)}/retry`,
      undefined,
      "Review",
    );
  };

  cancelReview = async (reviewId: string) => {
    await this.send("DELETE", `/api/reviews/${encodeURIComponent(reviewId)}`, undefined, "Review");
  };

  setPushback = async (issueId: string, reason: string | null) => {
    const path = `/api/issues/${encodeURIComponent(issueId)}/pushback`;
    await (reason === null
      ? this.send("DELETE", path, undefined, "Issue")
      : this.send("PUT", path, { reason }, "Issue"));
  };

  deleteProject = async (id: string) => {
    await this.send("DELETE", `/api/projects/${encodeURIComponent(id)}`, undefined, "Project");
  };

  getChecklist = () => this.request<Checklist>("/api/rules");

  saveChecklist = async (update: ChecklistUpdate) => {
    switch (update.type) {
      case "sources":
        await this.send("PUT", "/api/settings/sources", update.sources);
        return;
      case "createRule":
      case "restoreRule":
        await this.send("POST", "/api/rules", update);
        return;
      case "updateRule": {
        const { id, ...rule } = update.rule;
        await this.send("PUT", `/api/rules/${encodeURIComponent(id)}`, { rule }, "Rule");
        return;
      }
      case "moveRule":
        await this.send(
          "PUT",
          `/api/rules/${encodeURIComponent(update.ruleId)}`,
          { move: update.direction },
          "Rule",
        );
        return;
      case "deleteRule":
        await this.send(
          "DELETE",
          `/api/rules/${encodeURIComponent(update.ruleId)}`,
          undefined,
          "Rule",
        );
        return;
    }
  };

  getUsage = () => this.request<Usage>("/api/usage");
}
