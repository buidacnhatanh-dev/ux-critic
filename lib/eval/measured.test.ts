import { checkOf, seedMeasuredRules, tallyByCheck } from "./measured";
import type { ExpectedIssue, ResultIssue } from "./score";

describe("measured checks scoring", () => {
  it("knows which check a principle belongs to", () => {
    expect(checkOf("wcag-1.4.3")).toBe("contrast");
    expect(checkOf("rule:body-text-16")).toBe("text_size");
    expect(checkOf("wcag-2.5.8")).toBe("target_size");
    expect(checkOf("rule:targets-44")).toBe("target_size");
    expect(checkOf("law-hick")).toBeNull();
  });

  it("uses the first run checklist with rule keys as ids", () => {
    expect(seedMeasuredRules()).toEqual({
      targetSize: { ruleId: "targets-44", min: 44 },
      textSize: { ruleId: "body-text-16", min: 16 },
      contrast: null,
    });
  });

  it("tallies planted, found and unexpected per check", () => {
    // Sample data for tests only.
    const planted: ExpectedIssue = {
      id: "faint",
      kind: "measured",
      principleId: "wcag-1.4.3",
      note: "",
      box: null,
    };
    const note: ResultIssue = {
      number: 1,
      kind: "measured",
      principleId: "wcag-1.4.3",
      title: "Low contrast",
      detail: "",
      severity: "high",
      confidence: null,
      region: null,
    };
    const tally = tallyByCheck([
      {
        expected: [planted],
        score: {
          found: [{ expected: planted, result: note }],
          missed: [],
          unexpected: [{ ...note, number: 2, principleId: "wcag-2.5.8" }],
        },
      },
    ]);
    expect(tally.contrast).toEqual({ planted: 1, found: 1, unexpected: 0 });
    expect(tally.target_size).toEqual({ planted: 0, found: 0, unexpected: 1 });
    expect(tally.text_size).toEqual({ planted: 0, found: 0, unexpected: 0 });
  });
});
