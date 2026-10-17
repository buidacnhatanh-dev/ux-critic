import {
  compareReviews,
  iou,
  matchIssues,
  normaliseBox,
  titleSimilarity,
  type CompareSide,
} from "./compare";
import type { Box, Issue, Measurement } from "./data/types";

// Sample data for tests only (docs/07 fixtures).

let nextId = 1;
function issue(overrides: Partial<Issue> & Pick<Issue, "principleId" | "title">): Issue {
  const id = overrides.id ?? `i${nextId++}`;
  return {
    id,
    number: 1,
    kind: "evaluated",
    detail: "detail",
    fix: "fix",
    severity: "medium",
    confidence: "medium",
    measurementId: null,
    region: null,
    pushback: null,
    ...overrides,
  };
}

function measurement(
  overrides: Partial<Measurement> & Pick<Measurement, "id" | "box">,
): Measurement {
  return {
    kind: "contrast",
    label: "Email address",
    value: 1.85,
    threshold: 4.5,
    passes: false,
    ...overrides,
  };
}

function side(issues: Issue[], measurements: Measurement[] = [], size = { w: 1000, h: 800 }) {
  return { width: size.w, height: size.h, issues, measurements } satisfies CompareSide;
}

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

describe("geometry and titles", () => {
  it("normalises boxes to 0…1 of the image", () => {
    expect(normaliseBox(box(100, 200, 500, 400), 1000, 800)).toEqual({
      x: 0.1,
      y: 0.25,
      w: 0.5,
      h: 0.5,
    });
  });

  it("computes intersection over union", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 1, y: 0, w: 2, h: 2 })).toBeCloseTo(2 / 6);
    expect(iou(a, { x: 5, y: 5, w: 1, h: 1 })).toBe(0);
    expect(iou(a, { x: 0, y: 0, w: 0, h: 0 })).toBe(0);
  });

  it("compares titles by tokens, ignoring case and punctuation", () => {
    expect(titleSimilarity('"Apply code" is too small', "apply code is too small!")).toBe(1);
    expect(titleSimilarity("Five payment options", "Five payment choices")).toBe(0.5);
    expect(titleSimilarity("Labels disappear", "Text is too faint")).toBe(0);
    expect(titleSimilarity("", "")).toBe(0);
  });
});

describe("compareReviews (docs/07 fixtures)", () => {
  it("identical versions: everything is still open", () => {
    const issues = [
      issue({
        id: "a",
        number: 1,
        principleId: "wcag-3.3.2",
        title: "No labels",
        region: box(10, 10, 300, 40),
      }),
      issue({
        id: "b",
        number: 2,
        principleId: "law-hick",
        title: "Too many options",
        region: box(10, 400, 600, 60),
      }),
      issue({ id: "c", number: 3, principleId: "nielsen-1", title: "No progress", region: null }),
    ];
    const copies = issues.map((i) => ({ ...i, id: `${i.id}2` }));
    const result = compareReviews(side(issues), side(copies));
    expect(result.fixed).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.stillOpen.map((p) => [p.from.id, p.to.id])).toEqual([
      ["a", "a2"],
      ["b", "b2"],
      ["c", "c2"],
    ]);
  });

  it("everything fixed: no issues in the new version", () => {
    const from = [
      issue({
        number: 1,
        principleId: "wcag-3.3.2",
        title: "No labels",
        region: box(0, 0, 10, 10),
      }),
      issue({ number: 2, principleId: "law-hick", title: "Too many options" }),
    ];
    const result = compareReviews(side(from), side([]));
    expect(result.fixed.map((f) => f.issue.title)).toEqual(["No labels", "Too many options"]);
    expect(result.stillOpen).toEqual([]);
    expect(result.added).toEqual([]);
  });

  it("a moved element still matches by title", () => {
    const from = issue({
      id: "old",
      principleId: "law-hick",
      title: "Five payment options compete",
      region: box(100, 100, 400, 50),
    });
    const to = issue({
      id: "new",
      principleId: "law-hick",
      title: "Five payment options compete",
      region: box(100, 600, 400, 50),
    });
    const result = compareReviews(side([from]), side([to]));
    expect(result.stillOpen).toEqual([{ from, to }]);
  });

  it("an element that moved and was renamed is fixed plus new", () => {
    const from = issue({
      principleId: "law-hick",
      title: "Five payment options",
      region: box(0, 0, 100, 20),
    });
    const to = issue({
      principleId: "law-hick",
      title: "Navigation has nine links",
      region: box(0, 500, 100, 20),
    });
    const result = compareReviews(side([from]), side([to]));
    expect(result.fixed.map((f) => f.issue)).toEqual([from]);
    expect(result.added).toEqual([to]);
  });

  it("two issues with the same principle in different places do not cross match", () => {
    const top = issue({
      id: "top",
      number: 1,
      principleId: "wcag-3.3.2",
      title: "Email field has no label",
      region: box(100, 100, 400, 40),
    });
    const bottom = issue({
      id: "bottom",
      number: 2,
      principleId: "wcag-3.3.2",
      title: "Card field has no label",
      region: box(100, 600, 400, 40),
    });
    const top2 = { ...top, id: "top2" };
    const bottom2 = { ...bottom, id: "bottom2" };

    // Both still there: each pairs with its own place, even though the titles are similar.
    const both = compareReviews(side([top, bottom]), side([bottom2, top2]));
    expect(both.stillOpen.map((p) => [p.from.id, p.to.id])).toEqual([
      ["top", "top2"],
      ["bottom", "bottom2"],
    ]);

    // Only the top one fixed, a different problem with the same principle appears elsewhere.
    const other = issue({
      id: "other",
      number: 1,
      principleId: "wcag-3.3.2",
      title: "Search box relies on a placeholder",
      region: box(700, 50, 200, 40),
    });
    const result = compareReviews(side([top]), side([other]));
    expect(result.stillOpen).toEqual([]);
    expect(result.fixed.map((f) => f.issue.id)).toEqual(["top"]);
    expect(result.added.map((i) => i.id)).toEqual(["other"]);
  });

  it("null regions match by title only", () => {
    const from = issue({
      id: "a",
      principleId: "nielsen-1",
      title: "No sign of how many steps are left",
      region: null,
    });
    const sameTitle = issue({
      id: "b",
      principleId: "nielsen-1",
      title: "No sign of how many steps are left",
      region: box(0, 0, 50, 50),
    });
    expect(matchIssues(side([from]), side([sameTitle]))).toHaveLength(1);

    const otherTitle = issue({
      id: "c",
      principleId: "nielsen-1",
      title: "Loading has no indicator",
      region: null,
    });
    expect(matchIssues(side([from]), side([otherTitle]))).toEqual([]);
  });

  it("different principles never match, even in the same place with the same title", () => {
    const a = issue({ principleId: "nielsen-1", title: "Same", region: box(0, 0, 50, 50) });
    const b = issue({ principleId: "nielsen-2", title: "Same", region: box(0, 0, 50, 50) });
    expect(matchIssues(side([a]), side([b]))).toEqual([]);
  });

  it("matches regions by overlap after normalising different image sizes", () => {
    const a = issue({
      principleId: "wcag-1.4.1",
      title: "Error only red",
      region: box(100, 100, 200, 100),
    });
    // Same place on a screenshot twice the size, different wording.
    const b = issue({
      principleId: "wcag-1.4.1",
      title: "Colour shows the state",
      region: box(200, 200, 400, 200),
    });
    const result = compareReviews(side([a]), side([b], [], { w: 2000, h: 1600 }));
    expect(result.stillOpen).toHaveLength(1);
  });

  it("one issue matches at most one other, best score first", () => {
    const a = issue({
      id: "a",
      principleId: "law-hick",
      title: "Too many options",
      region: box(0, 0, 100, 100),
    });
    const near = issue({
      id: "near",
      number: 1,
      principleId: "law-hick",
      title: "Too many options",
      region: box(0, 0, 100, 100),
    });
    const far = issue({
      id: "far",
      number: 2,
      principleId: "law-hick",
      title: "Too many options",
      region: box(500, 500, 100, 100),
    });
    const result = compareReviews(side([a]), side([far, near]));
    expect(result.stillOpen.map((p) => p.to.id)).toEqual(["near"]);
    expect(result.added.map((i) => i.id)).toEqual(["far"]);
  });
});

describe("values for fixed measured issues", () => {
  const faint = issue({
    id: "faint",
    kind: "measured",
    confidence: null,
    principleId: "wcag-1.4.3",
    title: "Helper text is too faint",
    measurementId: "m1",
    region: box(100, 100, 300, 20),
  });
  const before = measurement({
    id: "m1",
    box: box(100, 100, 300, 20),
    label: "We send your receipt",
  });

  it("shows the new value from an overlapping measurement of the same kind", () => {
    const after = measurement({
      id: "n1",
      box: box(100, 102, 300, 20),
      label: "Other text",
      value: 7.2,
      passes: true,
    });
    const size = measurement({
      id: "n2",
      kind: "text_size",
      box: box(100, 100, 300, 20),
      value: 16,
    });
    const result = compareReviews(side([faint], [before]), side([], [size, after]));
    expect(result.fixed).toEqual([
      { issue: faint, change: { kind: "contrast", before: 1.85, after: 7.2 } },
    ]);
  });

  it("matches by exact label when the text moved", () => {
    const moved = measurement({
      id: "n1",
      box: box(600, 700, 300, 20),
      label: "We send your receipt",
      value: 5.1,
    });
    const result = compareReviews(side([faint], [before]), side([], [moved]));
    expect(result.fixed[0]!.change).toEqual({ kind: "contrast", before: 1.85, after: 5.1 });
  });

  it("says no longer found instead of inventing a value", () => {
    const elsewhere = measurement({
      id: "n1",
      box: box(600, 700, 300, 20),
      label: "Different",
      value: 9,
    });
    const result = compareReviews(side([faint], [before]), side([], [elsewhere]));
    expect(result.fixed[0]!.change).toEqual({ kind: "contrast", before: 1.85, after: null });
  });

  it("has no value change for evaluated issues", () => {
    const evaluated = issue({ principleId: "wcag-3.3.2", title: "No labels" });
    expect(compareReviews(side([evaluated]), side([])).fixed[0]!.change).toBeNull();
  });
});
