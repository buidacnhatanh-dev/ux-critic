import { parseHex } from "../contrast";
import { measureScreen, type MeasuredRules } from "./measure-screen";
import { solidImage } from "./raw-image";

const WHITE = parseHex("#FFFFFF");
const FAINT = parseHex("#B9BFC8");
const INK = parseHex("#15181D");
const BLUE = parseHex("#1D4ED8");

const RULES: MeasuredRules = {
  targetSize: { ruleId: "r-target", min: 44 },
  textSize: { ruleId: "r-text", min: 16 },
  contrast: null,
};

// Scale 2. Text "lines" are solid strips covering the share of the box glyphs would.
const img = solidImage(800, 400, WHITE, [
  { box: { x: 20, y: 20, w: 120, h: 38 }, colour: INK }, // dark line, 38 px tall box
  { box: { x: 20, y: 120, w: 120, h: 38 }, colour: FAINT }, // faint line
  { box: { x: 400, y: 20, w: 200, h: 96 }, colour: BLUE }, // 100 × 48 CSS px button
  { box: { x: 400, y: 200, w: 60, h: 20 }, colour: BLUE }, // tiny link, 10 CSS px tall
  { box: { x: 400, y: 300, w: 200, h: 64 }, colour: BLUE }, // 32 CSS px tall button
]);

const result = measureScreen({
  img,
  scale: 2,
  textLines: [
    { label: "Readable", box: { x: 10, y: 10, w: 600, h: 58 } },
    { label: "We send your receipt to this address", box: { x: 10, y: 110, w: 300, h: 58 } },
  ],
  controls: [
    { label: "Pay", box: { x: 400, y: 20, w: 200, h: 96 } },
    { label: "Terms", box: { x: 400, y: 200, w: 60, h: 20 } },
    { label: "Filter", box: { x: 400, y: 300, w: 200, h: 64 } },
  ],
  rules: RULES,
});

describe("measureScreen", () => {
  it("keeps every check, passing or failing", () => {
    const kinds = result.measurements.map((m) => m.kind);
    expect(kinds.filter((k) => k === "contrast")).toHaveLength(2);
    expect(kinds.filter((k) => k === "text_size")).toHaveLength(2);
    // Two rows per control: WCAG 24 and the 44 px rule.
    expect(kinds.filter((k) => k === "target_size")).toHaveLength(6);
    expect(result.measurements.filter((m) => m.passes).length).toBeGreaterThan(0);
  });

  it("flags only the faint line for contrast, as high below 3 : 1", () => {
    const contrast = result.issues.filter((i) => i.principleId === "wcag-1.4.3");
    expect(contrast).toHaveLength(1);
    expect(contrast[0]!.title).toBe('"We send your receipt to this address" is too faint');
    expect(contrast[0]!.severity).toBe("high");
    expect(contrast[0]!.fix).toMatch(/^Use #[0-9A-F]{6} for this text/);
  });

  it("flags the tiny link against WCAG and the mid size button against the rule", () => {
    const wcag = result.issues.filter((i) => i.principleId === "wcag-2.5.8");
    expect(wcag.map((i) => i.title)).toEqual(['"Terms" is too small to tap']);
    expect(wcag[0]!.detail).toBe("10 px tall. Targets need at least 24 by 24 px.");
    const rule = result.issues.filter((i) => i.principleId === "rule:r-target");
    expect(rule.map((i) => i.title)).toEqual(['"Filter" is too small to tap']);
    expect(rule[0]!.severity).toBe("low");
  });

  it("links each issue to a failing measurement and uses its box as region", () => {
    for (const issue of result.issues) {
      const m = result.measurements.find((x) => x.key === issue.measurementKey)!;
      expect(m.passes).toBe(false);
      expect(issue.region).toEqual(m.box);
    }
  });

  it("flags small body text with the rule id", () => {
    const small = measureScreen({
      img,
      scale: 2,
      textLines: [
        { label: "A footnote that is long enough", box: { x: 10, y: 10, w: 600, h: 32 } },
      ],
      controls: [],
      rules: RULES,
    });
    const issue = small.issues.find((i) => i.principleId === "rule:r-text")!;
    expect(issue.detail).toBe(
      "About 13 px. My checklist asks for at least 16 px. Estimated from the text line height.",
    );
  });

  it("skips rule checks when the rules are off", () => {
    const off = measureScreen({
      img,
      scale: 2,
      textLines: [
        { label: "A footnote that is long enough", box: { x: 10, y: 10, w: 600, h: 32 } },
      ],
      controls: [{ label: "Filter", box: { x: 400, y: 300, w: 200, h: 64 } }],
      rules: { targetSize: null, textSize: null, contrast: null },
    });
    expect(off.measurements.map((m) => m.kind)).toEqual(["contrast", "target_size"]);
    expect(off.issues).toEqual([]);
  });
});
