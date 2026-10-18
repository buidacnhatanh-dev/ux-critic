/**
 * Runs one review inside the Next.js server process (docs/01, docs/03): prepare, measure,
 * evaluate, place. Started without awaiting; the browser polls GET /api/reviews/[id].
 * Measured results are saved before evaluation starts, and nothing here ever deletes them.
 */
import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { FAKE_MODEL, fakeEvaluate, isFakeAi } from "../fake-ai.ts";
import type { Db } from "../db/client.ts";
import { getChecklist, getReviewJob } from "../db/repo.ts";
import * as t from "../db/schema.ts";
import { readBox } from "../db/json.ts";
import type { ReviewStep } from "../data/types.ts";
import { hasClaude } from "../mode.ts";
import {
  callClaude,
  modelId,
  ReviewCancelledError,
  type ClaudeAnswer,
  type ClaudeUsage,
} from "./claude.ts";
import {
  enabledPrinciples,
  evaluateContent,
  EvaluationUnreadableError,
  EVALUATE_MAX_TOKENS,
  outputSchema,
  parseEvaluation,
  systemPrompt,
  userText,
  type EvaluatedIssue,
} from "./evaluate.ts";
import { imageForClaude, type ClaudeImage } from "./image.ts";
import { placeIssues } from "./place.ts";

/** Is Claude available: a key, or fake AI mode. */
export function claudeConnected(): boolean {
  return hasClaude(process.env);
}

/** Running reviews and their cancel switches. On globalThis so hot reloads keep them. */
const registry = ((
  globalThis as typeof globalThis & { __uxcRuns?: Map<string, AbortController> }
).__uxcRuns ??= new Map());

export function isRunning(reviewId: string): boolean {
  return registry.has(reviewId);
}

/** Aborts the running Claude call of a review (docs/03 "Cancel review"). */
export function abortReview(reviewId: string): void {
  registry.get(reviewId)?.abort();
  registry.delete(reviewId);
}

/** The answer of call 2, from Claude or from the fake AI fixtures. */
export type Evaluator = (input: {
  image: ClaudeImage;
  fileName: string;
  system: string;
  text: string;
  schema: Record<string, unknown>;
  signal: AbortSignal;
}) => Promise<ClaudeAnswer>;

export const defaultEvaluator: Evaluator = (input) =>
  isFakeAi()
    ? fakeEvaluate(input.fileName, input.image, input.signal)
    : callClaude({
        system: input.system,
        content: evaluateContent(input.image, input.text),
        schema: input.schema,
        maxTokens: EVALUATE_MAX_TOKENS,
        signal: input.signal,
      });

/** The model a call asks for; only used to explain a failure, never saved as the model. */
function requestedModel(): string {
  return isFakeAi() ? FAKE_MODEL : modelId();
}

export type RunOptions = { evaluator?: Evaluator; now?: () => Date };

class Stopped extends Error {}

function errorJson(message: string, detail: string | null) {
  return JSON.stringify({ message, detail });
}

/**
 * Runs a queued review to the end. Never throws: every outcome ends in a status. With
 * `evaluateOnly` it reruns evaluate and place on a partial review ("Retry evaluation").
 */
export async function runReview(
  db: Db,
  reviewId: string,
  options: RunOptions & { evaluateOnly?: boolean } = {},
): Promise<void> {
  const evaluator = options.evaluator ?? defaultEvaluator;
  const now = () => (options.now ? options.now() : new Date()).toISOString();
  const controller = new AbortController();
  registry.get(reviewId)?.abort();
  registry.set(reviewId, controller);
  const { signal } = controller;

  /** Writes only while the review is still ours: a cancelled review was deleted. */
  const update = (values: Partial<typeof t.reviews.$inferInsert>) => {
    if (signal.aborted) throw new Stopped();
    db.update(t.reviews).set(values).where(eq(t.reviews.id, reviewId)).run();
  };
  const setStep = (step: ReviewStep) => update({ status: "running", step });

  let usage: ClaudeUsage = { input: 0, output: 0 };
  let usedClaude = false;
  /** From the API response, after any fallback. */
  let answeredBy: string | null = null;
  let step: ReviewStep = options.evaluateOnly ? "evaluate" : "prepare";

  try {
    const job = getReviewJob(db, reviewId);
    const { version, sources } = job;

    // 1 prepare: load the stored PNG and make the image for Claude.
    if (!options.evaluateOnly) setStep("prepare");
    let image: ClaudeImage;
    try {
      image = await imageForClaude(await readFile(version.screenshotPath));
    } catch (error) {
      if (signal.aborted) throw new Stopped();
      update({
        status: "failed",
        step: "prepare",
        error: errorJson(
          "The screenshot couldn't be prepared.",
          error instanceof Error ? error.message : String(error),
        ),
        finishedAt: now(),
      });
      return;
    }

    // 2 measure: OCR, call 1 and the measuring maths arrive in M6. Whatever is measured is saved
    // here, before evaluation starts.
    if (!options.evaluateOnly) {
      step = "measure";
      setStep("measure");
    }

    // 3 evaluate
    step = "evaluate";
    setStep("evaluate");
    if (options.evaluateOnly) {
      // Earlier evaluated notes go; measured ones stay.
      db.delete(t.issues)
        .where(and(eq(t.issues.reviewId, reviewId), eq(t.issues.kind, "evaluated")))
        .run();
    }
    const checklist = getChecklist(db);
    const rules = checklist.rules.filter((r) => sources.ruleIds.includes(r.id));
    const principles = enabledPrinciples(sources.sets, rules);
    const failing = db
      .select()
      .from(t.measurements)
      .where(and(eq(t.measurements.reviewId, reviewId), eq(t.measurements.passes, 0)))
      .all();

    let evaluated: EvaluatedIssue[] = [];
    let unreadable: EvaluationUnreadableError | null = null;
    if (sources.evaluation && principles.length > 0) {
      usedClaude = true;
      let answer: ClaudeAnswer;
      try {
        answer = await evaluator({
          image,
          fileName: version.fileName,
          system: systemPrompt(principles),
          text: userText(version.context, failing),
          schema: outputSchema(principles.map((p) => p.id)),
          signal,
        });
      } catch (error) {
        if (signal.aborted || error instanceof ReviewCancelledError) throw new Stopped();
        // Timeout or network: failed, measured results kept. No model answered, so none is
        // saved; the one that was asked goes into the technical details.
        const cause =
          error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
        update({
          status: "failed",
          step: "evaluate",
          error: errorJson(
            error instanceof Error ? error.message : String(error),
            [`Requested model: ${requestedModel()}`, cause].filter(Boolean).join("\n"),
          ),
          model: null,
          finishedAt: now(),
        });
        return;
      }
      usage = answer.usage;
      answeredBy = answer.model;
      if (signal.aborted) throw new Stopped();
      try {
        if (answer.stopReason === "refusal" || answer.stopReason === "max_tokens") {
          throw new EvaluationUnreadableError(
            `The answer stopped early (stop reason: ${answer.stopReason}).`,
            answer.text,
          );
        }
        evaluated = parseEvaluation(answer.text, {
          allowedIds: principles.map((p) => p.id),
          size: image,
        }).issues;
      } catch (error) {
        if (!(error instanceof EvaluationUnreadableError)) throw error;
        unreadable = error;
      }
    }

    // 4 place
    step = "place";
    setStep("place");
    const measuredRows = db
      .select()
      .from(t.issues)
      .where(and(eq(t.issues.reviewId, reviewId), eq(t.issues.kind, "measured")))
      .all();
    const placed = placeIssues({
      measured: measuredRows.map((m) => ({
        principleId: m.principleId,
        title: m.title,
        detail: m.detail,
        fix: m.fix,
        severity: m.severity,
        measurementId: m.measurementId ?? "",
        region: readBox(m.region),
      })),
      evaluated,
      factor: image.factor,
      width: version.width,
      height: version.height,
    });

    if (signal.aborted) throw new Stopped();
    db.transaction((tx) => {
      // Measured issues keep their ids (push backs point at them); only numbers change.
      const measuredIds = new Map(measuredRows.map((m) => [m.measurementId, m.id]));
      for (const issue of placed) {
        if (issue.kind === "measured") {
          const id = measuredIds.get(issue.measurementId);
          if (id)
            tx.update(t.issues).set({ number: issue.number }).where(eq(t.issues.id, id)).run();
          continue;
        }
        tx.insert(t.issues)
          .values({
            id: crypto.randomUUID(),
            reviewId,
            number: issue.number,
            kind: "evaluated",
            principleId: issue.principleId,
            title: issue.title,
            detail: issue.detail,
            fix: issue.fix,
            severity: issue.severity,
            confidence: issue.confidence,
            measurementId: null,
            region: issue.region ? JSON.stringify(issue.region) : null,
          })
          .run();
      }
      const previous = tx
        .select({ input: t.reviews.inputTokens, output: t.reviews.outputTokens })
        .from(t.reviews)
        .where(eq(t.reviews.id, reviewId))
        .get();
      tx.update(t.reviews)
        .set({
          status: unreadable ? "partial" : "done",
          step: "place",
          error: unreadable
            ? errorJson(
                "The evaluation came back in a format the app couldn't read.",
                `${unreadable.message}\n\n${unreadable.raw}`,
              )
            : null,
          model: answeredBy,
          inputTokens: usedClaude
            ? (previous?.input ?? 0) + usage.input
            : (previous?.input ?? null),
          outputTokens: usedClaude
            ? (previous?.output ?? 0) + usage.output
            : (previous?.output ?? null),
          finishedAt: now(),
        })
        .where(eq(t.reviews.id, reviewId))
        .run();
    });
  } catch (error) {
    if (error instanceof Stopped || signal.aborted) return;
    // Placing should not fail; if it does, measured results stay and the review is partial.
    try {
      db.update(t.reviews)
        .set({
          status: step === "place" ? "partial" : "failed",
          step,
          error: errorJson(
            step === "place"
              ? "The notes couldn't be placed on the screenshot."
              : "Something went wrong while reviewing.",
            error instanceof Error ? (error.stack ?? error.message) : String(error),
          ),
          finishedAt: now(),
        })
        .where(eq(t.reviews.id, reviewId))
        .run();
    } catch {
      // The review is gone (cancelled or its project deleted): nothing left to record.
    }
  } finally {
    if (registry.get(reviewId) === controller) registry.delete(reviewId);
  }
}

/** Starts a review in the background (not awaited, docs/01). */
export function startReview(db: Db, reviewId: string, options: RunOptions = {}): Promise<void> {
  return runReview(db, reviewId, options);
}

/** "Retry evaluation" on a partial review: reruns evaluate and place only. */
export function retryEvaluation(db: Db, reviewId: string, options: RunOptions = {}) {
  db.update(t.reviews)
    .set({ status: "running", step: "evaluate", error: null, finishedAt: null })
    .where(eq(t.reviews.id, reviewId))
    .run();
  return runReview(db, reviewId, { ...options, evaluateOnly: true });
}
