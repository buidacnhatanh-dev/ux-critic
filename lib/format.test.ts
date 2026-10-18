import {
  checkedAgainst,
  measurementValue,
  plural,
  reviewSummary,
  shortDate,
  trend,
  valueChangeText,
  spendText,
} from "./format";

describe("format", () => {
  it("formats short dates", () => {
    expect(shortDate("2026-10-14T11:00:00.000Z")).toBe("14 Oct");
  });

  it("pluralises", () => {
    expect(plural(1, "issue")).toBe("1 issue");
    expect(plural(0, "issue")).toBe("0 issues");
  });

  it("formats measured values", () => {
    expect(measurementValue("contrast", 1.85)).toBe("1.85 : 1");
    expect(measurementValue("contrast", 13.444)).toBe("13.44 : 1");
    expect(measurementValue("target_size", 10.5)).toBe("10.5 px");
    expect(measurementValue("text_size", 13)).toBe("13 px");
  });

  it("describes value changes without inventing the new value", () => {
    expect(valueChangeText("contrast", 1.85, 7.2)).toBe("was 1.85 : 1, now 7.2 : 1");
    expect(valueChangeText("target_size", 10.5, null)).toBe("was 10.5 px, no longer found");
  });

  it("writes the trend line", () => {
    expect(trend(1, 4, "v1")).toEqual({ text: "3 fewer issues than v1", tone: "better" });
    expect(trend(3, 2, "v2")).toEqual({ text: "1 more issue than v2", tone: "worse" });
    expect(trend(2, 2, "v1")).toEqual({ text: "Same number of issues as v1", tone: "same" });
  });

  it("writes the review summary", () => {
    expect(reviewSummary(5, 1, "2026-10-13T10:00:00Z")).toBe(
      "5 issues · 1 I disagreed with · reviewed 13 Oct",
    );
    expect(reviewSummary(1, 0, null)).toBe("1 issue");
  });

  it("lists what a review was checked against", () => {
    const all = { nielsen: true, wcag: true, laws: true, mine: true };
    expect(checkedAgainst(all, 6)).toBe(
      "Nielsen's heuristics, WCAG 2.2, the Laws of UX and your 6 rules",
    );
    expect(checkedAgainst({ ...all, laws: false, mine: false }, 6)).toBe(
      "Nielsen's heuristics and WCAG 2.2",
    );
    expect(checkedAgainst({ ...all, nielsen: false, wcag: false, laws: false }, 1)).toBe(
      "your 1 rule",
    );
    expect(checkedAgainst({ nielsen: false, wcag: false, laws: false, mine: false }, 0)).toBe(
      "measured checks only",
    );
  });
});

describe("spendText", () => {
  const prices = { inputPerM: 2, outputPerM: 10 };
  it("adds input and output at their prices per million tokens", () => {
    expect(spendText({ input: 100_000, output: 20_000 }, prices)).toBe("€0.40");
    expect(spendText({ input: 0, output: 0 }, prices)).toBe("€0.00");
  });
  it("says less than a cent for tiny amounts", () => {
    expect(spendText({ input: 1000, output: 0 }, prices)).toBe("less than €0.01");
  });
});
