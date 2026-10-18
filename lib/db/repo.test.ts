// @vitest-environment node
import { eq } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../data/client";
import { failInterruptedReviews, INTERRUPTED_MESSAGE, openDb, seed } from "./client";
import * as repo from "./repo";
import * as t from "./schema";

const sources = { nielsen: true, wcag: true, laws: true, mine: true };

function setup() {
  const { db } = openDb(":memory:");
  const create = (overrides: Partial<repo.CreateReviewInput> = {}) =>
    repo.createReview(
      db,
      {
        projectId: null,
        newProjectName: "NeighborGoods",
        versionName: "v1",
        context: " Checkout ",
        scale: 2,
        fileName: "checkout.png",
        width: 1280,
        height: 800,
        sources,
        evaluation: true,
        model: "claude-sonnet-5-5",
        ...overrides,
      },
      (id) => `/tmp/${id}.png`,
    );
  return { db, create };
}

describe("migrations and seed", () => {
  it("creates every table and the six rules once", () => {
    const { db } = setup();
    const checklist = repo.getChecklist(db);
    expect(checklist.sources).toEqual(sources);
    expect(checklist.rules.map((r) => [r.position, r.kind, r.text])).toEqual([
      [1, "measured", "Touch targets are at least 44 by 44 px"],
      [2, "measured", "Body text is at least 16 px"],
      [3, "evaluated", "Every field has a visible label"],
      [4, "evaluated", "One primary button per screen"],
      [5, "evaluated", "Error messages say how to fix the problem"],
      [6, "evaluated", "Colour is never the only way to show a state"],
    ]);
    expect(checklist.rules[0]).toMatchObject({
      metric: "target_size_min",
      threshold: 44,
      enabled: true,
    });
    seed(db);
    expect(repo.getChecklist(db).rules).toHaveLength(6);
  });

  it("does not seed again after every rule was deleted", () => {
    const { db } = setup();
    for (const rule of repo.getChecklist(db).rules) {
      repo.saveChecklist(db, { type: "deleteRule", ruleId: rule.id });
    }
    seed(db);
    expect(repo.getChecklist(db).rules).toHaveLength(0);
  });
});

describe("creating a review", () => {
  it("creates project, version and queued review with the enabled rules", () => {
    const { db, create } = setup();
    const created = create();
    const review = repo.getReview(db, created.reviewId);
    expect(review).toMatchObject({
      status: "queued",
      step: "prepare",
      projectName: "NeighborGoods",
      model: "claude-sonnet-5-5",
      evaluationOff: false,
      issues: [],
    });
    expect(review.version).toMatchObject({
      name: "v1",
      context: "Checkout",
      scale: 2,
      width: 1280,
      screenshotUrl: `/api/screenshots/${created.versionId}`,
      reviewStatus: "queued",
    });
    expect(review.sources.ruleIds).toHaveLength(6);
    expect(created.screenshotPath).toBe(`/tmp/${created.versionId}.png`);
  });

  it("refuses a taken project name or version name, without regard to case", () => {
    const { create } = setup();
    const { projectId } = create();
    expect(() => create({ newProjectName: "neighborgoods" })).toThrow(ValidationError);
    const error = (() => {
      try {
        create({ projectId, newProjectName: null, versionName: "V1" });
      } catch (e) {
        return e as ValidationError;
      }
    })();
    expect(error?.field).toBe("version");
    expect(() => create({ projectId, newProjectName: null, versionName: "v2" })).not.toThrow();
  });

  it("refuses an empty project name and an unknown project", () => {
    const { create } = setup();
    expect(() => create({ newProjectName: "  " })).toThrow(ValidationError);
    expect(() => create({ projectId: "nope", newProjectName: null })).toThrow(NotFoundError);
  });

  it("stores whether evaluation runs", () => {
    const { db, create } = setup();
    const { reviewId } = create({ evaluation: false, model: "claude-sonnet-5-5" });
    expect(repo.getReview(db, reviewId)).toMatchObject({ evaluationOff: true, model: null });
  });
});

describe("projects", () => {
  it("lists newest activity first with counts of finished reviews", () => {
    const { db, create } = setup();
    const a = create({ newProjectName: "A" });
    db.update(t.reviews)
      .set({ status: "done", finishedAt: "2026-10-18T10:00:00.000Z" })
      .where(eq(t.reviews.id, a.reviewId))
      .run();
    db.insert(t.issues)
      .values({
        id: "i1",
        reviewId: a.reviewId,
        number: 1,
        kind: "evaluated",
        principleId: "nielsen-8",
        title: "t",
        detail: "d",
        fix: "f",
        severity: "high",
        confidence: "low",
      })
      .run();
    db.update(t.versions)
      .set({ createdAt: "2026-10-18T09:00:00.000Z" })
      .where(eq(t.versions.id, a.versionId))
      .run();
    create({ newProjectName: "B" });
    const list = repo.listProjects(db);
    expect(list.map((p) => p.name)).toEqual(["B", "A"]);
    expect(list[1]).toMatchObject({ counts: { high: 1, medium: 0, low: 0 }, versionCount: 1 });
    expect(list[0]!.counts).toBeNull();
  });

  it("deletes a project with everything in it and returns its screenshots", () => {
    const { db, create } = setup();
    const created = create();
    expect(repo.deleteProject(db, created.projectId)).toEqual([created.screenshotPath]);
    expect(db.select().from(t.versions).all()).toHaveLength(0);
    expect(db.select().from(t.reviews).all()).toHaveLength(0);
    expect(() => repo.getProject(db, created.projectId)).toThrow(NotFoundError);
  });
});

describe("cancel and try again", () => {
  it("cancel removes the version and the project made for it", () => {
    const { db, create } = setup();
    const created = create();
    expect(repo.cancelReview(db, created.reviewId)).toEqual([created.screenshotPath]);
    expect(repo.listProjects(db)).toEqual([]);
  });

  it("cancel keeps a project that has other versions", () => {
    const { db, create } = setup();
    const first = create();
    const second = create({ projectId: first.projectId, newProjectName: null, versionName: "v2" });
    repo.cancelReview(db, second.reviewId);
    expect(repo.getProject(db, first.projectId).versions.map((v) => v.name)).toEqual(["v1"]);
  });

  it("try again starts a new review of the same version, only after a failure", () => {
    const { db, create } = setup();
    const created = create();
    expect(() =>
      repo.restartReview(db, created.reviewId, { evaluation: true, model: "m" }),
    ).toThrow(ValidationError);
    db.update(t.reviews).set({ status: "failed" }).where(eq(t.reviews.id, created.reviewId)).run();
    const next = repo.restartReview(db, created.reviewId, { evaluation: true, model: "m" });
    expect(repo.getReview(db, next)).toMatchObject({ status: "queued", model: "m" });
    expect(repo.getProject(db, created.projectId).versions[0]!.reviewId).toBe(next);
  });
});

describe("server restart", () => {
  it("marks queued and running reviews failed and leaves finished ones alone", () => {
    const { db, create } = setup();
    const running = create({ newProjectName: "A" });
    const done = create({ newProjectName: "B" });
    db.update(t.reviews)
      .set({ status: "running", step: "evaluate" })
      .where(eq(t.reviews.id, running.reviewId))
      .run();
    db.update(t.reviews).set({ status: "done" }).where(eq(t.reviews.id, done.reviewId)).run();
    expect(failInterruptedReviews(db)).toBe(1);
    const review = repo.getReview(db, running.reviewId);
    expect(review.status).toBe("failed");
    expect(review.step).toBe("evaluate");
    expect(review.error?.message).toBe(INTERRUPTED_MESSAGE);
    expect(repo.getReview(db, done.reviewId).status).toBe("done");
  });
});

describe("push back and checklist", () => {
  it("saves, trims and removes a reason", () => {
    const { db, create } = setup();
    const { reviewId } = create();
    db.insert(t.issues)
      .values({
        id: "i1",
        reviewId,
        number: 1,
        kind: "evaluated",
        principleId: "nielsen-8",
        title: "t",
        detail: "d",
        fix: "f",
        severity: "low",
        confidence: "low",
      })
      .run();
    expect(() => repo.setPushback(db, "i1", "   ")).toThrow(ValidationError);
    repo.setPushback(db, "i1", "  Decorative link ");
    expect(repo.getReview(db, reviewId).issues[0]!.pushback?.reason).toBe("Decorative link");
    repo.setPushback(db, "i1", null);
    expect(repo.getReview(db, reviewId).issues[0]!.pushback).toBeNull();
    expect(() => repo.setPushback(db, "nope", "x")).toThrow(NotFoundError);
  });

  it("applies checklist updates and keeps positions in order", () => {
    const { db } = setup();
    repo.saveChecklist(db, { type: "sources", sources: { ...sources, laws: false } });
    repo.saveChecklist(db, {
      type: "createRule",
      rule: {
        text: "Never more than 2 typefaces",
        kind: "evaluated",
        metric: null,
        threshold: null,
        enabled: true,
      },
    });
    const rules = repo.getChecklist(db).rules;
    repo.saveChecklist(db, { type: "moveRule", ruleId: rules[6]!.id, direction: "up" });
    const after = repo.getChecklist(db);
    expect(after.sources.laws).toBe(false);
    expect(after.rules.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(after.rules[5]!.text).toBe("Never more than 2 typefaces");
    expect(() =>
      repo.saveChecklist(db, { type: "updateRule", rule: { ...after.rules[0]!, text: " " } }),
    ).toThrow(ValidationError);
  });

  it("sums token usage since a date", () => {
    const { db, create } = setup();
    const { reviewId } = create();
    db.update(t.reviews)
      .set({ inputTokens: 1200, outputTokens: 300 })
      .where(eq(t.reviews.id, reviewId))
      .run();
    expect(repo.tokenUsageSince(db, "2000-01-01T00:00:00.000Z")).toEqual({
      input: 1200,
      output: 300,
    });
    expect(repo.tokenUsageSince(db, "2999-01-01T00:00:00.000Z")).toEqual({ input: 0, output: 0 });
  });
});
