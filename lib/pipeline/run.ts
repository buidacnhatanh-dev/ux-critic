/**
 * Runs one review inside the Next.js server process (docs/01, docs/03): prepare, measure,
 * evaluate, place. Started without awaiting; the browser polls GET /api/reviews/[id].
 * Measured results are saved before evaluation starts, and nothing here ever deletes them.
 */
import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { FAKE_MODEL, fakeEvaluate, fakeLocate, isFakeAi } from "../fake-ai.ts";
import type { Db } from "../db/client.ts";
import { getChecklist, getReviewJob } from "../db/repo.ts";
import * as t from "../db/schema.ts";
import { readBox, type ReviewSources } from "../db/json.ts";
import type { ReviewStep, Rule, SkippedCheck } from "../data/types.ts";
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
import { imageForClaude, loadRaw, toOriginal, type ClaudeImage } from "./image.ts";
import {
  LOCATE_MAX_TOKENS,
  LOCATE_SCHEMA,
  LOCATE_SYSTEM_PROMPT,
  LocateUnreadableError,
  locateContent,
  parseControls,
} from "./locate.ts";
import { estimateFontSizeFromOcr } from "./measure.ts";
import { measureScreen, type LocatedControl, type MeasuredRules } from "./measure-screen.ts";
import { findTextLines, type TextLine } from "./ocr.ts";
import { numberInReadingOrder } from "./order.ts";
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

/** The answer of call 1 (locate controls), from Claude or from the fake AI fixtures. */
export type Locator = (input: {
  image: ClaudeImage;
  fileName: string;
  signal: AbortSignal;
}) => Promise<ClaudeAnswer>;

export const defaultLocator: Locator = (input) =>
  isFakeAi()
    ? fakeLocate(input.fileName, input.image, input.signal)
    : callClaude({
        system: LOCATE_SYSTEM_PROMPT,
        content: locateContent(input.image),
        schema: LOCATE_SCHEMA,
        maxTokens: LOCATE_MAX_TOKENS,
        signal: input.signal,
      });

/** Text lines on the original screenshot (OCR). Tests pass their own. */
export type TextFinder = (png: Buffer) => Promise<TextLine[]>;

/**
 * Measured rules from My checklist that were on for this review (docs/04): enabled, in the
 * review's rule ids, and only while "My checklist" is a source. With two rules for one metric the
 * stricter one counts. A missing rule leaves the default (contrast 4.5, WCAG 24 px targets) and
 * turns the text size check off, since its principle is the rule.
 */
export function measuredRulesFor(rules: Rule[], sources: ReviewSources): MeasuredRules {
  const pick = (metric: Rule["metric"]) => {
    if (!sources.sets.mine) return null;
    const matching = rules.filter(
      (r) =>
        r.kind === "measured" &&
        r.metric === metric &&
        r.threshold !== null &&
        sources.ruleIds.includes(r.id),
    );
    if (matching.length === 0) return null;
    const strictest = matching.reduce((a, b) => (b.threshold! > a.threshold! ? b : a));
    return { ruleId: strictest.id, min: strictest.threshold! };
  };
  return {
    targetSize: pick("target_size_min"),
    textSize: pick("text_size_min"),
    contrast: pick("contrast_min"),
  };
}

/** The model a call asks for; only used to explain a failure, never saved as the model. */
function requestedModel(): string {
  return isFakeAi() ? FAKE_MODEL : modelId();
}

export type RunOptions = {
  evaluator?: Evaluator;
  locator?: Locator;
  findText?: TextFinder;
  now?: () => Date;
};

class Stopped extends Error {}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
  const locator = options.locator ?? defaultLocator;
  const findText = options.findText ?? findTextLines;
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
    let png: Buffer;
    try {
      png = await readFile(version.screenshotPath);
      image = await imageForClaude(png);
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

    // 2 measure (docs/04): OCR text lines, call 1 for the controls, then contrast and sizes from
    // the pixels. Saved here, before evaluation starts. A failed call 1 only skips target sizes.
    if (!options.evaluateOnly) {
      step = "measure";
      setStep("measure");
      const skipped: SkippedCheck[] = [];

      let lines: TextLine[] = [];
      try {
        lines = await findText(png);
      } catch (error) {
        if (signal.aborted) throw new Stopped();
        skipped.push({ check: "text", reason: "failed", detail: messageOf(error) });
      }
      if (signal.aborted) throw new Stopped();

      let controls: LocatedControl[] = [];
      if (!sources.evaluation) {
        skipped.push({ check: "target_size", reason: "no_claude", detail: null });
      } else {
        try {
          const answer = await locator({ image, fileName: version.fileName, signal });
          usedClaude = true;
          usage = answer.usage;
          if (answer.stopReason === "refusal" || answer.stopReason === "max_tokens") {
            throw new LocateUnreadableError(
              `The answer stopped early (stop reason: ${answer.stopReason}).`,
              answer.text,
            );
          }
          controls = parseControls(answer.text, image).controls.map((c) => ({
            label: c.label,
            box: toOriginal(c.box, image.factor),
          }));
        } catch (error) {
          if (signal.aborted || error instanceof ReviewCancelledError) throw new Stopped();
          const raw = error instanceof LocateUnreadableError ? `\n\n${error.raw}` : "";
          skipped.push({
            check: "target_size",
            reason: "failed",
            detail: `${messageOf(error)}${raw}`,
          });
        }
      }

      const screen = measureScreen({
        img: await loadRaw(png),
        scale: version.scale,
        textLines: lines.map((line) => ({
          label: line.text,
          box: line.box,
          fontSize: estimateFontSizeFromOcr(line.rowHeight, line.box.h, version.scale),
        })),
        controls,
        rules: measuredRulesFor(getChecklist(db).rules, sources),
      });
      if (signal.aborted) throw new Stopped();
      db.transaction((tx) => {
        const ids = new Map<string, string>();
        for (const m of screen.measurements) {
          const id = crypto.randomUUID();
          ids.set(m.key, id);
          tx.insert(t.measurements)
            .values({
              id,
              reviewId,
              kind: m.kind,
              label: m.label,
              box: JSON.stringify(m.box),
              value: m.value,
              threshold: m.threshold,
              passes: m.passes ? 1 : 0,
            })
            .run();
        }
        for (const issue of numberInReadingOrder(screen.issues)) {
          tx.insert(t.issues)
            .values({
              id: crypto.randomUUID(),
              reviewId,
              number: issue.number,
              kind: "measured",
              principleId: issue.principleId,
              title: issue.title,
              detail: issue.detail,
              fix: issue.fix,
              severity: issue.severity,
              confidence: null,
              measurementId: ids.get(issue.measurementKey) ?? null,
              region: JSON.stringify(issue.region),
            })
            .run();
        }
        // Call 1's tokens are saved with the measured results; call 2 adds its own later.
        tx.update(t.reviews)
          .set({
            skippedChecks: skipped.length ? JSON.stringify(skipped) : null,
            ...(usedClaude ? { inputTokens: usage.input, outputTokens: usage.output } : {}),
          })
          .where(eq(t.reviews.id, reviewId))
          .run();
      });
      usage = { input: 0, output: 0 };
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
      usage = { input: 0, output: 0 };
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
