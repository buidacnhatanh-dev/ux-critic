import {
  renderReport,
  reviewTemplate,
  unexpectedId,
  type EvalResults,
  type EvalRun,
} from "./report";
import type { ResultIssue } from "./score";

// Sample data for tests only: no real model output.
const label: ResultIssue = {
  number: 1,
  kind: "evaluated",
  principleId: "wcag-3.3.2",
  title: "Fields have no visible label",
  detail: "Placeholder text is the only label.",
  severity: "high",
  confidence: "high",
  region: { x: 100, y: 100, w: 200, h: 100 },
};
const extra: ResultIssue = {
  ...label,
  number: 2,
  principleId: "law-hick",
  title: "Too many choices",
  region: null,
};

function run(n: number, issues: ResultIssue[], over: Partial<EvalRun> = {}): EvalRun {
  return {
    run: n,
    status: "done",
    error: null,
    model: "model-under-test",
    durationMs: 10_000,
    inputTokens: 1000,
    outputTokens: 200,
    skippedChecks: [],
    issues,
    ...over,
  };
}

function results(fakeAi = false): EvalResults {
  return {
    version: 1,
    startedAt: "2026-11-02T10:00:00.000Z",
    finishedAt: "2026-11-02T10:05:00.000Z",
    fakeAi,
    requestedModel: "model-under-test",
    runsPerCase: 2,
    cases: [
      {
        name: "login",
        description: "",
        width: 1000,
        height: 1000,
        expected: [
          {
            id: "labels",
            kind: "evaluated",
            principleId: "wcag-3.3.2",
            note: "Placeholder labels",
            box: { x: 100, y: 100, w: 200, h: 100 },
          },
          {
            id: "tiny-link",
            kind: "measured",
            principleId: "wcag-2.5.8",
            note: "Tiny link",
            box: { x: 10, y: 900, w: 40, h: 10 },
          },
        ],
        runs: [
          run(1, [label, extra]),
          run(2, [], { status: "failed", error: "Timed out", model: null, inputTokens: null }),
        ],
      },
    ],
  };
}

describe("renderReport", () => {
  it("reports found, missed, unexpected, recall per run and the spread", () => {
    const md = renderReport(results(), null);
    expect(md).toContain("Found 0–1 of 2 planted problems per run (mean 0.5), recall 25 %");
    expect(md).toContain("| Found | 1 | 0 |");
    expect(md).toContain("| Missed | 1 | 2 |");
    expect(md).toContain("| Unexpected | 1 | 0 |");
    expect(md).toContain("| Recall | 50 % | 0 % |");
    expect(md).toContain("| login | 2 | 0–1 | 1–2 | 0–1 | 1 |");
    expect(md).toContain("1 of 2 reviews failed");
    expect(md).toContain("* login run 2: failed; Timed out");
  });

  it("splits measured and evaluated", () => {
    const md = renderReport(results(), null);
    expect(md).toContain("| Measured | 1 | 0 | 0 % | 0 |");
    expect(md).toContain("| Evaluated | 1 | 0.5 | 50 % | 0.5 |");
  });

  it("averages time and tokens over the reviews that got an answer", () => {
    const md = renderReport(results(), null);
    expect(md).toContain("mean 10.0 s");
    expect(md).toContain("input mean 1000 (1000–1000), output mean 200 (200–200)");
    expect(md).toContain("Model: model-under-test");
  });

  it("lists missed problems and unexpected notes with their verdicts", () => {
    const review = reviewTemplate(results(), null);
    const id = unexpectedId("login", 1, 2);
    expect(Object.keys(review.notes)).toEqual([id]);
    review.notes[id]!.verdict = "invented";
    const md = renderReport(results(), review);
    expect(md).toContain("login · tiny-link (measured, wcag-2.5.8): missed in 2 of 2 runs");
    expect(md).toContain("`login/run-1/#2` evaluated, law-hick");
    expect(md).toContain("*Verdict: invented*");
    expect(md).toContain("(0 real, 1 invented, 0 not reviewed yet)");
  });

  it("warns loudly in fake AI mode", () => {
    expect(renderReport(results(true), null)).toContain("Fake AI mode");
    expect(renderReport(results(false), null)).not.toContain("Fake AI mode");
  });
});

describe("reviewTemplate", () => {
  it("keeps verdicts already set", () => {
    const first = reviewTemplate(results(), null);
    first.notes[unexpectedId("login", 1, 2)]!.verdict = "real";
    const again = reviewTemplate(results(), first);
    expect(again.notes[unexpectedId("login", 1, 2)]!.verdict).toBe("real");
  });
});
