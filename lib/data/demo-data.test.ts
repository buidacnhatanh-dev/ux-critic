import data from "@/demo/data.json";
import handwritten from "@/demo/handwritten.json";
import { demoReviewSources } from "./demo-data";
import { demoDataSchema } from "./demo-schema";
import { demoSourceLine } from "./demo-source";

describe("demo/data.json", () => {
  const parsed = demoDataSchema.parse(data);

  it("matches the schema and its references", () => {
    expect(parsed.projects.map((p) => p.name)).toEqual([
      "Checkout practice",
      "Sign up form",
      "Analytics dashboard",
    ]);
  });

  it("is handwritten, so the badge says so", () => {
    expect(parsed.reviews.every((r) => r.source.kind === "handwritten")).toBe(true);
    expect(demoSourceLine(demoReviewSources())).toBe("Sample reviews written by hand");
  });

  it("has no model, token or timing numbers for handwritten reviews", () => {
    for (const review of parsed.reviews) {
      expect(review.model).toBeNull();
      expect(review.inputTokens).toBeNull();
      expect(review.outputTokens).toBeNull();
    }
  });

  it("numbers issues 1…n per review", () => {
    for (const review of parsed.reviews) {
      const numbers = parsed.issues.filter((i) => i.reviewId === review.id).map((i) => i.number);
      expect(numbers.sort((a, b) => a - b)).toEqual(numbers.map((_, i) => i + 1));
    }
  });

  it("names a docs/05 principle or a rule on every evaluated issue", () => {
    const ruleIds = new Set(parsed.rules.map((r) => `rule:${r.id}`));
    for (const issue of parsed.issues) {
      if (issue.principleId.startsWith("rule:")) expect(ruleIds.has(issue.principleId)).toBe(true);
    }
  });

  it("keeps measured numbers out of the handwritten source", () => {
    const prose = JSON.stringify(handwritten.evaluated);
    expect(prose).not.toMatch(/\d+(\.\d+)?\s*:\s*1/); // no contrast ratios
    expect(prose).not.toMatch(/\d+\s*px/); // no sizes
  });

  it("has checkout v3 clean, for the No issues found state", () => {
    expect(parsed.issues.filter((i) => i.reviewId === "review-checkout-v3")).toEqual([]);
  });

  it("has one pushback, on the sign up form", () => {
    expect(parsed.pushbacks.map((p) => p.issueId)).toEqual(["signup-v1-hidden-password-rules"]);
  });
});
