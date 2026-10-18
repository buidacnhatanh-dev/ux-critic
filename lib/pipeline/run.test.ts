// @vitest-environment node
import { eq } from "drizzle-orm";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { fakeEvaluate } from "../fake-ai";
import { openDb } from "../db/client";
import * as repo from "../db/repo";
import * as t from "../db/schema";
import { ClaudeTimeoutError } from "./claude";
import { abortReview, retryEvaluation, runReview, type Evaluator } from "./run";

const dir = mkdtempSync(join(tmpdir(), "uxc-run-"));
const sources = { nielsen: true, wcag: true, laws: true, mine: true };

async function setup(fileName = "checkout.png", width = 1280, height = 800) {
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
    .png()
    .toBuffer();
  writeFileSync(created.screenshotPath, png);
  return { db, ...created };
}

/** The fake AI fixtures, without the 500 ms wait unless asked. */
const fake: Evaluator = (input) => fakeEvaluate(input.fileName, input.image, input.signal);

describe("runReview", () => {
  it("runs every step and saves numbered evaluated notes (normal fixture)", async () => {
    const { db, reviewId } = await setup();
    await runReview(db, reviewId, { evaluator: fake });
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
      evaluator: async (input) => ({ ...(await fake(input)), model: "claude-opus-4-8" }),
    });
    expect(repo.getReview(db, reviewId)).toMatchObject({
      status: "partial",
      model: "claude-opus-4-8",
    });
    db.update(t.versions).set({ fileName: "checkout.png" }).run();
    await retryEvaluation(db, reviewId, {
      evaluator: async (input) => ({ ...(await fake(input)), model: "claude-sonnet-5-5" }),
    });
    expect(repo.getReview(db, reviewId)).toMatchObject({
      status: "done",
      model: "claude-sonnet-5-5",
    });
  });

  it("maps boxes back to original pixels for large screenshots", async () => {
    const { db, reviewId } = await setup("checkout.png", 5152, 3220);
    await runReview(db, reviewId, { evaluator: fake });
    const [first] = repo.getReview(db, reviewId).issues;
    // The fixture puts the first note at 10 % / 30 % of the image Claude received.
    expect(first!.region).toEqual({ x: 516, y: 966, w: 2060, h: 386 });
  });

  it("finishes with no issues for the empty fixture", async () => {
    const { db, reviewId } = await setup("fake-empty.png");
    await runReview(db, reviewId, { evaluator: fake });
    expect(repo.getReview(db, reviewId)).toMatchObject({ status: "done", issues: [] });
  });

  it("is partial with the raw answer kept when the answer is unreadable", async () => {
    const { db, reviewId } = await setup("fake-unreadable.png");
    await runReview(db, reviewId, { evaluator: fake });
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
    await runReview(db, reviewId, { evaluator: fake });
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
      evaluator: (input) => {
        prompt = input.text;
        return fake(input);
      },
    });
    expect(prompt).toContain('contrast, "Email", 2.1, 4.5');
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
    await runReview(db, reviewId, { evaluator: fake });
    expect(repo.getReview(db, reviewId)).toMatchObject({ status: "failed", step: "prepare" });
  });

  it("skips Claude when evaluation is off (measured checks only)", async () => {
    const { db, reviewId } = await setup();
    db.update(t.reviews)
      .set({ sources: JSON.stringify({ sets: sources, ruleIds: [], evaluation: false }) })
      .where(eq(t.reviews.id, reviewId))
      .run();
    const evaluator = vi.fn(fake);
    await runReview(db, reviewId, { evaluator });
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
    await runReview(db, reviewId, { evaluator: counted });
    expect(repo.getReview(db, reviewId).status).toBe("partial");
    db.update(t.versions).set({ fileName: "checkout.png" }).run();
    await retryEvaluation(db, reviewId, { evaluator: counted });
    const review = repo.getReview(db, reviewId);
    expect(review.status).toBe("done");
    expect(review.issues).toHaveLength(3);
    expect([review.inputTokens, review.outputTokens]).toEqual([2000, 400]);
  });

  it("retry evaluation keeps measured issues and their push backs", async () => {
    const { db, reviewId } = await setup();
    await runReview(db, reviewId, { evaluator: fake });
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
    await retryEvaluation(db, reviewId, { evaluator: fake });
    const issues = repo.getReview(db, reviewId).issues;
    expect(issues).toHaveLength(4);
    expect(issues[0]).toMatchObject({ id: "mi1", number: 1, pushback: { reason: "Decorative" } });
  });
});
