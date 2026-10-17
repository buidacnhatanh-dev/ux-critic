import { parseHex } from "../contrast";
import { contrastIssueText, targetSizeIssueText, textSizeIssueText } from "./measured-text";

const WHITE = parseHex("#FFFFFF");

describe("contrastIssueText", () => {
  it("follows the docs/04 wording", () => {
    expect(
      contrastIssueText({
        label: "Card number",
        ratio: 1.8512,
        threshold: 4.5,
        background: WHITE,
        suggestion: { hex: "#6B7280", ratio: 4.83 },
      }),
    ).toEqual({
      title: '"Card number" is too faint',
      detail: '"Card number" measures 1.85 : 1 on #FFFFFF. Text needs at least 4.5 : 1.',
      fix: "Use #6B7280 for this text: it measures 4.83 : 1 on #FFFFFF.",
    });
  });

  it("uses a generic title for long text", () => {
    const text = contrastIssueText({
      label: "Your card is charged only when you press Pay now at the end",
      ratio: 2,
      threshold: 4.5,
      background: WHITE,
      suggestion: null,
    });
    expect(text.title).toBe("Text is too faint");
    expect(text.detail.startsWith("This text measures 2.00 : 1")).toBe(true);
    expect(text.fix).toContain("at least 4.5 : 1");
  });

  it("notes that bold is not detected between 3 and 4.5", () => {
    const text = contrastIssueText({
      label: "Total",
      ratio: 3.5,
      threshold: 4.5,
      background: WHITE,
      suggestion: null,
    });
    expect(text.detail).toContain("bold is not detected");
  });
});

describe("textSizeIssueText", () => {
  it("says the size is estimated", () => {
    expect(textSizeIssueText({ size: 12.6, threshold: 16 })).toEqual({
      title: "Body text is small",
      detail:
        "About 13 px. My checklist asks for at least 16 px. Estimated from the text line height.",
      fix: "Use at least 16 px for body text.",
    });
  });
});

describe("targetSizeIssueText", () => {
  it("reports the smaller dimension against WCAG", () => {
    expect(
      targetSizeIssueText({ label: "Terms", size: 14, dimension: "tall", threshold: 24 }),
    ).toEqual({
      title: '"Terms" is too small to tap',
      detail: "14 px tall. Targets need at least 24 by 24 px.",
      fix: "Make it at least 24 px tall, ideally 44 px.",
    });
  });

  it("drops the ideally note for the 44 px rule", () => {
    expect(
      targetSizeIssueText({ label: "Filter", size: 36, dimension: "wide", threshold: 44 }).fix,
    ).toBe("Make it at least 44 px wide.");
  });
});
