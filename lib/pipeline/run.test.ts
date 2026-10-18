// @vitest-environment node
import { eq } from "drizzle-orm";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { fakeEvaluate, fakeLocate } from "../fake-ai";
import { openDb } from "../db/client";
import * as repo from "../db/repo";
import * as t from "../db/schema";
import { ClaudeTimeoutError } from "./claude";
import type { TextLine } from "./ocr";
import {
  abortReview,
  measuredRulesFor,
  retryEvaluation,
  runReview,
  type Evaluator,
  type Locator,
} from "./run";

const dir = mkdtempSync(join(tmpdir(), "uxc-run-"));
const sources = { nielsen: true, wcag: true, laws: true, mine: true };

async function setup(
  fileName = "checkout.png",
  width = 1280,
  height = 800,
  draw: { box: { x: number; y: number; w: number; h: number }; colour: string }[] = [],
) {
  const { db } = openDb(":memory:");
  const created = repo.createReview(
    db,
    {
      projectId: null,
      newProjectName: "NeighborGoods",
      versionName: "v1",
      context: "Checkout",
      scale: 2,
      fileName,
      width,
      height,
      sources,
      evaluation: true,
    },
    (id) => join(dir, `${id}.png`),
  );
  const png = await sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite(
      await Promise.all(
        draw.map(async ({ box, colour }) => ({
          input: await sharp({
            create: { width: box.w, height: box.h, channels: 3, background: colour },
          })
            .png()
            .toBuffer(),
          left: box.x,
          top: box.y,
        })),
      ),
    )
    .png()
    .toBuffer();
  writeFileSync(created.screenshotPath, png);
  return { db, ...created };
}

/** The fake AI fixtures, without the 500 ms wait unless asked. */
const fake: Evaluator = (input) => fakeEvaluate(input.fileName, input.image, input.signal);
const fakeLocator: Locator = (input) => fakeLocate(input.fileName, input.image, input.signal);
/** No OCR and the fake call 1 unless a test says otherwise: tests never reach the API. */
const base = { findText: async (): Promise<TextLine[]> => [], locator: fakeLocator };

describe("runReview", () => {
  it("runs every step and saves numbered evaluated notes (normal fixture)", async () => {
    const { db, reviewId } = await setup();
    await runReview(db, reviewId, { ...base, evaluator: fake });
    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("done");
    expect(review.step).toBe("place");
    expect(review.error).toBeNull();
    expect(review.finishedAt).not.toBeNull();
    expect(review.issues.map((i) => [i.number, i.kind, i.principleId])).toEqual([
      [1, "evaluated", "wcag-3.3.2"],
      [2, "evaluated", "law-hick"],
      [3, "evaluated", "nielsen-8"],
    ]);
    expect(review.issues[0]!.region).toEqual({ x: 128, y: 240, w: 512, h: 96 });
    expect(review.issues[2]!.region).toBeNull();
    expect(review.inputTokens).toBe(0);
    expect(review.model).toBe("fake-ai");
  });

  it("saves the model that answered, not the one requested (fallbacks)", async () => {
    vi.stubEnv("UXC_MODEL", "claude-sonnet-5-5");
    const { db, reviewId } = await setup();
    await runReview(db, reviewId, {
      ...base,
      evaluator: async (input) => ({ ...(await fake(input)), model: "claude-opus-4-8" }),
    });
    expect(repo.getReview(db, reviewId)).toMatchObject({
      status: "done",
      model: "claude-opus-4-8",
    });
    vi.unstubAllEnvs();
  });

  it("saves the answering model on a partial review and replaces it on retry", async () => {
    const { db, reviewId } = await setup("fake-unreadable.png");
    await runReview(db, reviewId, {
      ...base,
      evaluator: async (input) => ({ ...(await fake(input)), model: "claude-opus-4-8" }),
    });
    expect(repo.getReview(db, reviewId)).toMatchObject({
      status: "partial",
      model: "claude-opus-4-8",
    });
    db.update(t.versions).set({ fileName: "checkout.png" }).run();
    await retryEvaluation(db, reviewId, {
      ...base,
      evaluator: async (input) => ({ ...(await fake(input)), model: "claude-sonnet-5-5" }),
    });
    expect(repo.getReview(db, reviewId)).toMatchObject({
      status: "done",
      model: "claude-sonnet-5-5",
    });
  });

  it("maps boxes back to original pixels for large screenshots", async () => {
    const { db, reviewId } = await setup("checkout.png", 5152, 3220);
    await runReview(db, reviewId, { ...base, evaluator: fake });
    const [first] = repo.getReview(db, reviewId).issues;
    // The fixture puts the first note at 10 % / 30 % of the image Claude received.
    expect(first!.region).toEqual({ x: 516, y: 966, w: 2060, h: 386 });
  });

  it("finishes with no issues for the empty fixture", async () => {
    const { db, reviewId } = await setup("fake-empty.png");
    await runReview(db, reviewId, { ...base, evaluator: fake });
    expect(repo.getReview(db, reviewId)).toMatchObject({ status: "done", issues: [] });
  });

  it("is partial with the raw answer kept when the answer is unreadable", async () => {
    const { db, reviewId } = await setup("fake-unreadable.png");
    await runReview(db, reviewId, { ...base, evaluator: fake });
    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("partial");
    expect(review.error?.message).toMatch(/couldn't read/);
    expect(review.error?.detail).toContain("I reviewed the screen");
  });

  it("fails on a timeout and keeps measured results", async () => {
    const { db, reviewId } = await setup("fake-timeout.png");
    db.insert(t.measurements)
      .values({
        id: "m1",
        reviewId,
        kind: "contrast",
        label: "Terms",
        box: '{"x":1,"y":1,"w":10,"h":10}',
        value: 2.1,
        threshold: 4.5,
        passes: 0,
      })
      .run();
    db.insert(t.issues)
      .values({
        id: "mi1",
        reviewId,
        number: 1,
        kind: "measured",
        principleId: "wcag-1.4.3",
        title: '"Terms" is too faint',
        detail: "d",
        fix: "f",
        severity: "high",
        measurementId: "m1",
        region: '{"x":1,"y":1,"w":10,"h":10}',
      })
      .run();
    await runReview(db, reviewId, { ...base, evaluator: fake });
    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("failed");
    expect(review.step).toBe("evaluate");
    expect(review.error?.message).toBe(new ClaudeTimeoutError(60_000).message);
    // Nothing answered: no model is saved, the requested one is in the details.
    expect(review.model).toBeNull();
    expect(review.error?.detail).toContain("Requested model:");
    expect(review.measurements).toHaveLength(1);
    expect(review.issues.map((i) => i.id)).toEqual(["mi1"]);
  });

  it("sends failing measurements to Claude and drops evaluated duplicates of them", async () => {
    const { db, reviewId } = await setup();
    db.insert(t.measurements)
      .values({
        id: "m1",
        reviewId,
        kind: "contrast",
        label: "Email",
        box: '{"x":130,"y":245,"w":500,"h":90}',
        value: 2.1,
        threshold: 4.5,
        passes: 0,
      })
      .run();
    db.insert(t.issues)
      .values({
        id: "mi1",
        reviewId,
        number: 1,
        kind: "measured",
        principleId: "wcag-3.3.2",
        title: "measured",
        detail: "d",
        fix: "f",
        severity: "high",
        measurementId: "m1",
        region: '{"x":130,"y":245,"w":500,"h":90}',
      })
      .run();
    let prompt = "";
    await runReview(db, reviewId, {
      ...base,
      evaluator: (input) => {
        prompt = input.text;
        return fake(input);
      },
    });
    expect(prompt).toContain('contrast, "Email", 2.1 : 1, needs 4.5 : 1');
    const issues = repo.getReview(db, reviewId).issues;
    expect(issues.map((i) => [i.number, i.kind, i.principleId])).toEqual([
      [1, "measured", "wcag-3.3.2"],
      [2, "evaluated", "law-hick"],
      [3, "evaluated", "nielsen-8"],
    ]);
  });

  it("fails at prepare when the screenshot is missing", async () => {
    const { db, reviewId, versionId } = await setup();
    db.update(t.versions)
      .set({ screenshotPath: join(dir, "missing.png") })
      .where(eq(t.versions.id, versionId))
      .run();
    await runReview(db, reviewId, { ...base, evaluator: fake });
    expect(repo.getReview(db, reviewId)).toMatchObject({ status: "failed", step: "prepare" });
  });

  it("skips Claude when evaluation is off (measured checks only)", async () => {
    const { db, reviewId } = await setup();
    db.update(t.reviews)
      .set({ sources: JSON.stringify({ sets: sources, ruleIds: [], evaluation: false }) })
      .where(eq(t.reviews.id, reviewId))
      .run();
    const evaluator = vi.fn(fake);
    await runReview(db, reviewId, { ...base, evaluator });
    expect(evaluator).not.toHaveBeenCalled();
    expect(repo.getReview(db, reviewId)).toMatchObject({
      status: "done",
      evaluationOff: true,
      inputTokens: null,
      model: null,
    });
  });

  it("stops writing when the review is cancelled mid call", async () => {
    const { db, reviewId } = await setup();
    let started!: () => void;
    const inCall = new Promise<void>((resolve) => (started = resolve));
    const run = runReview(db, reviewId, {
      ...base,
      evaluator: (input) => {
        started();
        return fakeEvaluate(input.fileName, input.image, input.signal);
      },
    });
    await inCall;
    expect(repo.getReview(db, reviewId)).toMatchObject({ status: "running", step: "evaluate" });
    abortReview(reviewId);
    repo.cancelReview(db, reviewId);
    await run;
    expect(db.select().from(t.reviews).all()).toEqual([]);
    expect(db.select().from(t.issues).all()).toEqual([]);
  });

  it("adds token usage over a retry of the evaluation", async () => {
    const { db, reviewId } = await setup("fake-unreadable.png");
    const counted: Evaluator = async (input) => ({
      ...(await fake(input)),
      usage: { input: 1000, output: 200 },
    });
    await runReview(db, reviewId, { ...base, evaluator: counted });
    expect(repo.getReview(db, reviewId).status).toBe("partial");
    db.update(t.versions).set({ fileName: "checkout.png" }).run();
    await retryEvaluation(db, reviewId, { ...base, evaluator: counted });
    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("done");
    expect(review.issues).toHaveLength(3);
    expect([review.inputTokens, review.outputTokens]).toEqual([2000, 400]);
  });

  it("retry evaluation keeps measured issues and their push backs", async () => {
    const { db, reviewId } = await setup();
    await runReview(db, reviewId, { ...base, evaluator: fake });
    db.insert(t.issues)
      .values({
        id: "mi1",
        reviewId,
        number: 9,
        kind: "measured",
        principleId: "wcag-1.4.3",
        title: "measured",
        detail: "d",
        fix: "f",
        severity: "high",
        measurementId: "m1",
        region: '{"x":0,"y":0,"w":10,"h":10}',
      })
      .run();
    repo.setPushback(db, "mi1", "Decorative");
    await retryEvaluation(db, reviewId, { ...base, evaluator: fake });
    const issues = repo.getReview(db, reviewId).issues;
    expect(issues).toHaveLength(4);
    expect(issues[0]).toMatchObject({ id: "mi1", number: 1, pushback: { reason: "Decorative" } });
  });
});

describe("measure step", () => {
  /** Faint text (#B9BFC8 on white is 1.85 : 1) and a dark control 40 × 20 px (20 × 10 CSS px). */
  const faint = { box: { x: 100, y: 100, w: 400, h: 30 }, colour: "#b9bfc8" };
  const button = { box: { x: 100, y: 300, w: 40, h: 20 }, colour: "#15181d" };
  const line: TextLine = {
    text: "We send your receipt to this address",
    confidence: 96,
    box: faint.box,
    rowHeight: 28,
  };
  const findText = async () => [line];
  const locator: Locator = async () => ({
    text: JSON.stringify({
      controls: [{ role: "button", label: "Pay", x: 100, y: 300, width: 40, height: 20 }],
    }),
    stopReason: "end_turn",
    usage: { input: 300, output: 40 },
    model: "fake-ai",
  });

  it("saves measurements and measured issues before evaluation starts", async () => {
    const { db, reviewId } = await setup("fake-empty.png", 1280, 800, [faint, button]);
    let seen: ReturnType<typeof repo.getReview> | null = null;
    let prompt = "";
    await runReview(db, reviewId, {
      findText,
      locator,
      evaluator: (input) => {
        seen = repo.getReview(db, reviewId);
        prompt = input.text;
        return fake(input);
      },
    });
    // Already saved while call 2 runs.
    expect(seen!.step).toBe("evaluate");
    expect(seen!.issues.map((i) => i.title)).toEqual([
      '"We send your receipt to this address" is too faint',
      '"Pay" is too small to tap',
    ]);
    // Passed into the evaluation prompt.
    expect(prompt).toContain('contrast, "We send your receipt to this address", 1.85 : 1');
    expect(prompt).toContain('target_size, "Pay", 10 px, needs 24 px');

    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("done");
    expect(review.skippedChecks).toEqual([]);
    expect(review.issues.map((i) => [i.number, i.kind, i.principleId, i.severity])).toEqual([
      [1, "measured", "wcag-1.4.3", "high"],
      [2, "measured", "wcag-2.5.8", "medium"],
    ]);
    expect(review.issues[1]!.detail).toBe("10 px tall. Targets need at least 24 by 24 px.");
    // Every check is kept, pass or fail: contrast and text size per line, both target checks.
    expect(review.measurements.map((m) => [m.kind, m.value, m.threshold, m.passes])).toEqual([
      ["contrast", 1.85, 4.5, false],
      ["text_size", 16, 16, true],
      ["target_size", 10, 24, false],
      ["target_size", 10, 44, false],
    ]);
    expect(review.issues[0]!.measurementId).toBe(review.measurements[0]!.id);
    // Call 1's tokens count too.
    expect([review.inputTokens, review.outputTokens]).toEqual([300, 40]);
  });

  it("measured checks only: no Claude call, contrast and text size measured, target size skipped", async () => {
    const { db, reviewId } = await setup("checkout.png", 1280, 800, [faint, button]);
    db.update(t.reviews)
      .set({ sources: JSON.stringify({ sets: sources, ruleIds: [], evaluation: false }) })
      .where(eq(t.reviews.id, reviewId))
      .run();
    const evaluator = vi.fn(fake);
    const noCall = vi.fn(locator);
    await runReview(db, reviewId, { findText, locator: noCall, evaluator });
    expect(noCall).not.toHaveBeenCalled();
    expect(evaluator).not.toHaveBeenCalled();
    const review = repo.getReview(db, reviewId);
    expect(review).toMatchObject({
      status: "done",
      evaluationOff: true,
      inputTokens: null,
      skippedChecks: [{ check: "target_size", reason: "no_claude", detail: null }],
    });
    expect(review.issues.map((i) => i.principleId)).toEqual(["wcag-1.4.3"]);
    expect(review.measurements.map((m) => m.kind)).toEqual(["contrast"]);
  });

  it("skips target sizes when call 1 fails, keeps the rest and goes on", async () => {
    const { db, reviewId } = await setup("checkout.png", 1280, 800, [faint, button]);
    await runReview(db, reviewId, {
      findText,
      locator: async () => {
        throw new Error("503 error: overloaded");
      },
      evaluator: fake,
    });
    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("done");
    expect(review.skippedChecks).toEqual([
      { check: "target_size", reason: "failed", detail: "503 error: overloaded" },
    ]);
    expect(review.issues.filter((i) => i.kind === "measured").map((i) => i.principleId)).toEqual([
      "wcag-1.4.3",
    ]);
    expect(review.issues.filter((i) => i.kind === "evaluated")).toHaveLength(3);
  });

  it("skips target sizes when call 1's answer is unreadable, keeping the raw answer", async () => {
    const { db, reviewId } = await setup("fake-unreadable.png", 1280, 800, [faint]);
    await runReview(db, reviewId, { findText, locator: fakeLocator, evaluator: fake });
    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("partial");
    expect(review.skippedChecks![0]).toMatchObject({ check: "target_size", reason: "failed" });
    expect(review.skippedChecks![0]!.detail).toContain("I reviewed the screen");
    expect(review.issues.map((i) => i.kind)).toEqual(["measured"]);
  });

  it("maps control boxes from the image Claude saw back to original pixels", async () => {
    // 5152 px wide: Claude gets half the size, so its box is doubled.
    const big = { box: { x: 200, y: 600, w: 80, h: 40 }, colour: "#15181d" };
    const { db, reviewId } = await setup("fake-empty.png", 5152, 3220, [big]);
    await runReview(db, reviewId, {
      findText: async () => [],
      locator: async () => ({
        text: JSON.stringify({
          controls: [{ role: "button", label: "Go", x: 100, y: 300, width: 40, height: 20 }],
        }),
        stopReason: "end_turn",
        usage: { input: 0, output: 0 },
        model: "fake-ai",
      }),
      evaluator: fake,
    });
    const review = repo.getReview(db, reviewId);
    expect(review.issues[0]).toMatchObject({
      title: '"Go" is too small to tap',
      region: { x: 200, y: 600, w: 80, h: 40 },
    });
  });

  it("goes on without text checks when OCR fails", async () => {
    const { db, reviewId } = await setup("fake-empty.png", 1280, 800, [faint]);
    await runReview(db, reviewId, {
      findText: async () => {
        throw new Error("OCR worker crashed");
      },
      locator: fakeLocator,
      evaluator: fake,
    });
    expect(repo.getReview(db, reviewId)).toMatchObject({
      status: "done",
      skippedChecks: [{ check: "text", reason: "failed", detail: "OCR worker crashed" }],
      issues: [],
    });
  });

  it("retry evaluation does not measure again", async () => {
    const { db, reviewId } = await setup("fake-unreadable.png", 1280, 800, [faint]);
    await runReview(db, reviewId, { findText, locator: fakeLocator, evaluator: fake });
    const ocr = vi.fn(findText);
    db.update(t.versions).set({ fileName: "checkout.png" }).run();
    await retryEvaluation(db, reviewId, { findText: ocr, locator: fakeLocator, evaluator: fake });
    expect(ocr).not.toHaveBeenCalled();
    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("done");
    expect(review.measurements).toHaveLength(2);
    expect(review.issues.filter((i) => i.kind === "measured")).toHaveLength(1);
  });
});

describe("measuredRulesFor", () => {
  const rule = (id: string, metric: string, threshold: number, kind = "measured") =>
    ({ id, text: id, kind, metric, threshold, position: 1, enabled: true }) as never;
  const rules = [
    rule("t44", "target_size_min", 44),
    rule("t48", "target_size_min", 48),
    rule("s16", "text_size_min", 16),
    rule("c7", "contrast_min", 7),
  ];

  it("uses the rules that were on, the stricter one per metric", () => {
    const on = { sets: sources, ruleIds: ["t44", "t48", "s16"], evaluation: true };
    expect(measuredRulesFor(rules, on)).toEqual({
      targetSize: { ruleId: "t48", min: 48 },
      textSize: { ruleId: "s16", min: 16 },
      contrast: null,
    });
  });

  it("uses none when My checklist is off", () => {
    const off = {
      sets: { ...sources, mine: false },
      ruleIds: ["t44", "s16", "c7"],
      evaluation: true,
    };
    expect(measuredRulesFor(rules, off)).toEqual({
      targetSize: null,
      textSize: null,
      contrast: null,
    });
  });
});
