import { ruleErrors, ruleFields } from "./rules";

describe("own rule drafts", () => {
  const draft = {
    text: "Body text is at least 16 px",
    kind: "measured" as const,
    metric: "text_size_min" as const,
    threshold: "16",
  };

  it("accepts a complete measured rule and keeps its threshold", () => {
    expect(ruleErrors(draft)).toEqual({});
    expect(ruleFields(draft)).toEqual({
      text: "Body text is at least 16 px",
      kind: "measured",
      metric: "text_size_min",
      threshold: 16,
    });
  });

  it("needs text, and a positive threshold for measured rules", () => {
    expect(ruleErrors({ ...draft, text: "  " }).text).toBeDefined();
    expect(ruleErrors({ ...draft, threshold: "" }).threshold).toBeDefined();
    expect(ruleErrors({ ...draft, threshold: "-3" }).threshold).toBeDefined();
    expect(ruleErrors({ ...draft, threshold: "abc" }).threshold).toBeDefined();
  });

  it("drops metric and threshold for evaluated rules", () => {
    const evaluated = { ...draft, kind: "evaluated" as const, threshold: "" };
    expect(ruleErrors(evaluated)).toEqual({});
    expect(ruleFields(evaluated)).toMatchObject({ metric: null, threshold: null });
  });
});
