import type { Issue, ReviewDetail } from "./data/types";
import { failedSample, partialSample } from "./sample-states";

const issue = (number: number, kind: Issue["kind"]): Issue => ({
  id: `i${number}`,
  number,
  kind,
  principleId: "wcag-1.4.3",
  title: `Issue ${number}`,
  detail: "d",
  fix: "f",
  severity: "high",
  confidence: kind === "evaluated" ? "high" : null,
  measurementId: kind === "measured" ? `m${number}` : null,
  region: null,
  pushback: kind === "measured" ? { reason: "r", createdAt: "2026-10-01T00:00:00Z" } : null,
});

const review = {
  id: "r1",
  status: "done",
  step: "place",
  issues: [
    issue(1, "evaluated"),
    issue(2, "measured"),
    issue(3, "evaluated"),
    issue(4, "measured"),
  ],
} as unknown as ReviewDetail;

describe("sample states", () => {
  it("keeps only measured issues, renumbered, for the partial sample", () => {
    const sample = partialSample(review);
    expect(sample.status).toBe("partial");
    expect(sample.issues.map((i) => [i.number, i.title])).toEqual([
      [1, "Issue 2"],
      [2, "Issue 4"],
    ]);
    expect(sample.issues.every((i) => i.id.startsWith("sample:") && i.pushback === null)).toBe(
      true,
    );
  });

  it("stops the failed sample at evaluate with a timeout", () => {
    const sample = failedSample(review);
    expect(sample).toMatchObject({ status: "failed", step: "evaluate", issues: [] });
    expect(sample.error?.message).toMatch(/timed out/);
  });
});
