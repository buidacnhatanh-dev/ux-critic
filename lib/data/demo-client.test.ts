import data from "@/demo/data.json";
import { NotFoundError, ValidationError } from "./client";
import {
  DEMO_STORAGE_KEY,
  DemoClient,
  SIMULATED_TOTAL_MS,
  emptyOverlay,
  parseOverlay,
  simulatedProgress,
} from "./demo-client";
import { demoDataSchema, type DemoData } from "./demo-schema";

const DATA: DemoData = demoDataSchema.parse(data);

class MemoryStorage {
  map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
  removeItem = (k: string) => void this.map.delete(k);
}

function setup(opts: { storage?: MemoryStorage | null; start?: number } = {}) {
  const storage = opts.storage === undefined ? new MemoryStorage() : opts.storage;
  let now = opts.start ?? Date.parse("2026-10-20T10:00:00.000Z");
  let id = 0;
  const client = new DemoClient({
    storage,
    now: () => now,
    loadData: async () => DATA,
    newId: () => `id${++id}`,
  });
  return { client, storage, advance: (ms: number) => (now += ms) };
}

describe("simulatedProgress", () => {
  it("walks the four steps and finishes after the total", () => {
    expect(simulatedProgress(0)).toEqual({ step: "prepare", done: false });
    expect(simulatedProgress(1000).step).toBe("measure");
    expect(simulatedProgress(3000).step).toBe("evaluate");
    expect(simulatedProgress(SIMULATED_TOTAL_MS - 1)).toEqual({ step: "place", done: false });
    expect(simulatedProgress(SIMULATED_TOTAL_MS)).toEqual({ step: "place", done: true });
    expect(SIMULATED_TOTAL_MS).toBeGreaterThanOrEqual(5000);
    expect(SIMULATED_TOTAL_MS).toBeLessThanOrEqual(7000);
  });
});

describe("parseOverlay", () => {
  it("starts fresh on missing, broken or old data", () => {
    expect(parseOverlay(null)).toEqual(emptyOverlay());
    expect(parseOverlay("{not json")).toEqual(emptyOverlay());
    expect(parseOverlay('{"v":0}')).toEqual(emptyOverlay());
  });

  it("keeps valid parts", () => {
    const parsed = parseOverlay('{"v":1,"deletedProjectIds":["a"],"pushbacks":[]}');
    expect(parsed.deletedProjectIds).toEqual(["a"]);
    expect(parsed.pushbacks).toEqual({});
  });
});

describe("DemoClient reading", () => {
  it("is in demo mode", () => {
    expect(setup().client.mode).toBe("demo");
  });

  it("lists the sample projects, newest activity first, with counts and trend", async () => {
    const projects = await setup().client.listProjects();
    expect(projects.map((p) => p.name)).toEqual([
      "Checkout practice",
      "Analytics dashboard",
      "Sign up form",
    ]);
    const checkout = projects[0]!;
    expect(checkout.latestVersion?.name).toBe("v3");
    expect(checkout.counts).toEqual({ high: 0, medium: 0, low: 0 });
    expect(checkout.previousIssueCount).toBe(
      DATA.issues.filter((i) => i.reviewId === "review-checkout-v2").length,
    );
    expect(checkout.previousVersionName).toBe("v2");
    expect(checkout.versionCount).toBe(3);
    expect(projects.find((p) => p.name === "Sign up form")!.previousIssueCount).toBeNull();
  });

  it("returns a project with versions newest first", async () => {
    const project = await setup().client.getProject("checkout-practice");
    expect(project.versions.map((v) => v.name)).toEqual(["v3", "v2", "v1"]);
    expect(project.versions[2]!.issueCount).toBe(
      DATA.issues.filter((i) => i.reviewId === "review-checkout-v1").length,
    );
  });

  it("gives each version its context, review date and severity counts", async () => {
    const project = await setup().client.getProject("checkout-practice");
    const v1 = project.versions[2]!;
    const row = DATA.versions.find((v) => v.id === "checkout-v1")!;
    const issues = DATA.issues.filter((i) => i.reviewId === "review-checkout-v1");
    expect(v1.context).toBe(row.context);
    expect(v1.reviewedAt).toBe(DATA.reviews.find((r) => r.id === "review-checkout-v1")!.finishedAt);
    expect(v1.counts).toEqual({
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      low: issues.filter((i) => i.severity === "low").length,
    });
  });

  it("returns a review with issues in number order, measurements and the source", async () => {
    const review = await setup().client.getReview("review-checkout-v1");
    expect(review.status).toBe("done");
    expect(review.projectName).toBe("Checkout practice");
    expect(review.issues.map((i) => i.number)).toEqual(review.issues.map((_, i) => i + 1));
    expect(review.measurements.length).toBeGreaterThan(0);
    expect(review.source).toEqual({ kind: "handwritten" });
    const measured = review.issues.filter((i) => i.kind === "measured");
    for (const issue of measured) {
      expect(review.measurements.some((m) => m.id === issue.measurementId && !m.passes)).toBe(true);
    }
  });

  it("includes the prepared pushback", async () => {
    const review = await setup().client.getReview("review-signup-v1");
    const pushed = review.issues.filter((i) => i.pushback);
    expect(pushed.map((i) => i.id)).toEqual(["signup-v1-hidden-password-rules"]);
    expect((await setup().client.getProject("sign-up-form")).versions[0]!.pushbackCount).toBe(1);
  });

  it("throws NotFoundError for unknown ids", async () => {
    const { client } = setup();
    await expect(client.getProject("nope")).rejects.toBeInstanceOf(NotFoundError);
    await expect(client.getReview("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists samples without their review ids", async () => {
    const samples = await setup().client.listSamples();
    expect(samples).toHaveLength(5);
    expect(samples[0]).not.toHaveProperty("reviewId");
    expect(samples[0]!.screenshotUrl).toMatch(/^\/demo\/.+\.png$/);
  });
});

describe("DemoClient pushbacks", () => {
  it("saves a trimmed reason in localStorage and reads it back in a new client", async () => {
    const { client, storage } = setup();
    await client.setPushback("checkout-v1-five-methods", "  Card is the only option most see  ");
    const stored = JSON.parse(storage!.getItem(DEMO_STORAGE_KEY)!);
    expect(stored.pushbacks["checkout-v1-five-methods"].reason).toBe(
      "Card is the only option most see",
    );
    const again = new DemoClient({ storage, loadData: async () => DATA });
    const issue = (await again.getReview("review-checkout-v1")).issues.find(
      (i) => i.id === "checkout-v1-five-methods",
    );
    expect(issue?.pushback?.reason).toBe("Card is the only option most see");
  });

  it("undoes a prepared pushback", async () => {
    const { client } = setup();
    await client.setPushback("signup-v1-hidden-password-rules", null);
    const review = await client.getReview("review-signup-v1");
    expect(review.issues.some((i) => i.pushback)).toBe(false);
  });

  it("refuses an empty reason and unknown issues", async () => {
    const { client } = setup();
    await expect(client.setPushback("checkout-v1-five-methods", "   ")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(client.setPushback("nope", "x")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("DemoClient delete and reset", () => {
  it("hides a deleted sample project and brings it back on reset", async () => {
    const { client, storage } = setup();
    await client.deleteProject("analytics-dashboard");
    expect((await client.listProjects()).map((p) => p.id)).not.toContain("analytics-dashboard");
    await expect(client.getProject("analytics-dashboard")).rejects.toBeInstanceOf(NotFoundError);
    await client.resetDemo();
    expect(storage!.getItem(DEMO_STORAGE_KEY)).toBeNull();
    expect((await client.listProjects()).map((p) => p.id)).toContain("analytics-dashboard");
  });

  it("can delete everything (First use state)", async () => {
    const { client } = setup();
    for (const p of await client.listProjects()) await client.deleteProject(p.id);
    expect(await client.listProjects()).toEqual([]);
  });

  it("throws for unknown projects", async () => {
    await expect(setup().client.deleteProject("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("DemoClient startReview", () => {
  const input = {
    mode: "demo" as const,
    projectId: null,
    newProjectName: "My test",
    versionName: "v1",
    context: "",
    sampleId: "signup",
  };

  it("simulates the steps, shows measured results first, then the prepared review", async () => {
    const { client, advance } = setup();
    const { reviewId } = await client.startReview(input);

    let review = await client.getReview(reviewId);
    expect(review).toMatchObject({
      status: "running",
      step: "prepare",
      issues: [],
      finishedAt: null,
    });

    advance(3000);
    review = await client.getReview(reviewId);
    expect(review.step).toBe("evaluate");
    expect(review.issues.length).toBeGreaterThan(0);
    expect(review.issues.every((i) => i.kind === "measured")).toBe(true);

    advance(SIMULATED_TOTAL_MS);
    review = await client.getReview(reviewId);
    const prepared = await client.getReview("review-signup-v1");
    expect(review.status).toBe("done");
    expect(review.projectName).toBe("My test");
    expect(review.issues.map((i) => i.title)).toEqual(prepared.issues.map((i) => i.title));
    // Own ids, and the prepared pushback does not carry over.
    expect(review.issues.every((i) => i.id.startsWith(`${reviewId}:`))).toBe(true);
    expect(review.issues.some((i) => i.pushback)).toBe(false);
  });

  it("cancels a running review and removes its version and new project", async () => {
    const { client } = setup();
    const { reviewId } = await client.startReview(input);
    await client.cancelReview(reviewId);
    await expect(client.getReview(reviewId)).rejects.toMatchObject({ name: "NotFoundError" });
    expect((await client.listProjects()).some((p) => p.name === "My test")).toBe(false);
    await expect(client.cancelReview("review-signup-v1")).rejects.toMatchObject({
      name: "ValidationError",
    });
  });

  it("finishes at once when instant (reduced motion)", async () => {
    const { client } = setup();
    const { reviewId } = await client.startReview({ ...input, instant: true });
    expect((await client.getReview(reviewId)).status).toBe("done");
  });

  it("adds a version to an existing project and refuses a duplicate name", async () => {
    const { client } = setup();
    await client.startReview({
      ...input,
      projectId: "checkout-practice",
      newProjectName: null,
      versionName: "v4",
      sampleId: "checkout-v3",
    });
    const project = await client.getProject("checkout-practice");
    expect(project.versions.map((v) => v.name)).toEqual(["v4", "v3", "v2", "v1"]);
    await expect(
      client.startReview({
        ...input,
        projectId: "checkout-practice",
        newProjectName: null,
        versionName: "V2",
      }),
    ).rejects.toMatchObject({ name: "ValidationError", field: "version" });
  });

  it("refuses missing names, taken project names and unknown samples", async () => {
    const { client } = setup();
    await expect(client.startReview({ ...input, newProjectName: " " })).rejects.toMatchObject({
      field: "project",
    });
    await expect(
      client.startReview({ ...input, newProjectName: "checkout practice" }),
    ).rejects.toMatchObject({ field: "project" });
    await expect(client.startReview({ ...input, versionName: "" })).rejects.toMatchObject({
      field: "version",
    });
    await expect(client.startReview({ ...input, sampleId: "nope" })).rejects.toMatchObject({
      field: "sample",
    });
  });

  it("deletes created projects with their reviews", async () => {
    const { client } = setup();
    const { reviewId } = await client.startReview(input);
    const created = (await client.listProjects()).find((p) => p.name === "My test")!;
    await client.deleteProject(created.id);
    await expect(client.getReview(reviewId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("DemoClient checklist", () => {
  it("starts from the six seed rules and all sources on", async () => {
    const checklist = await setup().client.getChecklist();
    expect(checklist.rules).toHaveLength(6);
    expect(checklist.sources).toEqual({ nielsen: true, wcag: true, laws: true, mine: true });
  });

  it("saves changes in the browser", async () => {
    const { client, storage } = setup();
    await client.saveChecklist({
      type: "sources",
      sources: { nielsen: false, wcag: true, laws: true, mine: true },
    });
    await client.saveChecklist({
      type: "createRule",
      rule: {
        text: " Never more than 2 typefaces ",
        kind: "evaluated",
        metric: null,
        threshold: null,
        enabled: true,
      },
    });
    const checklist = await client.getChecklist();
    expect(checklist.sources.nielsen).toBe(false);
    expect(checklist.rules.at(-1)).toMatchObject({
      id: "id1",
      text: "Never more than 2 typefaces",
      position: 7,
    });
    expect(JSON.parse(storage!.getItem(DEMO_STORAGE_KEY)!).checklist.rules).toHaveLength(7);
  });
});

describe("DemoClient with blocked storage", () => {
  const blocked = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
    removeItem: () => {
      throw new Error("SecurityError");
    },
  };

  it("keeps changes in memory and never throws", async () => {
    const client = new DemoClient({ storage: blocked, loadData: async () => DATA });
    await client.setPushback("checkout-v1-five-methods", "Fine for this shop");
    const issue = (await client.getReview("review-checkout-v1")).issues.find(
      (i) => i.id === "checkout-v1-five-methods",
    );
    expect(issue?.pushback?.reason).toBe("Fine for this shop");
    await expect(client.resetDemo()).resolves.toBeUndefined();
  });

  it("works without any storage (server render)", async () => {
    const client = new DemoClient({ storage: null, loadData: async () => DATA });
    expect(await client.listProjects()).toHaveLength(3);
  });
});
