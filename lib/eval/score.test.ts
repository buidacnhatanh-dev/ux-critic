import { recall, scoreRun, spread, type ExpectedIssue, type ResultIssue } from "./score";

// Sample data for tests only.
const size = { width: 1000, height: 1000 };

function expected(overrides: Partial<ExpectedIssue> & Pick<ExpectedIssue, "id">): ExpectedIssue {
  return {
    kind: "evaluated",
    principleId: "wcag-3.3.2",
    note: "Placeholders are the only labels",
    box: { x: 100, y: 100, w: 200, h: 100 },
    ...overrides,
  };
}

function result(overrides: Partial<ResultIssue> & Pick<ResultIssue, "number">): ResultIssue {
  return {
    kind: "evaluated",
    principleId: "wcag-3.3.2",
    title: "Fields have no visible label",
    detail: "detail",
    severity: "high",
    confidence: "high",
    region: { x: 110, y: 100, w: 200, h: 100 },
    ...overrides,
  };
}

describe("scoreRun", () => {
  it("finds a result with the same principle in the same place", () => {
    const score = scoreRun([expected({ id: "a" })], [result({ number: 1 })], size);
    expect(score.found).toHaveLength(1);
    expect(score.found[0]!.expected.id).toBe("a");
    expect(score.missed).toEqual([]);
    expect(score.unexpected).toEqual([]);
  });

  it("misses a result with another principle, and counts it as unexpected", () => {
    const score = scoreRun(
      [expected({ id: "a" })],
      [result({ number: 1, principleId: "law-hick" })],
      size,
    );
    expect(score.found).toEqual([]);
    expect(score.missed.map((e) => e.id)).toEqual(["a"]);
    expect(score.unexpected.map((r) => r.number)).toEqual([1]);
  });

  it("needs the region to overlap enough (IoU 0.25) unless the titles are similar", () => {
    const far = result({ number: 1, region: { x: 700, y: 700, w: 200, h: 100 } });
    expect(scoreRun([expected({ id: "a" })], [far], size).found).toEqual([]);
    const sameTitle = result({
      number: 1,
      title: "Placeholders are the only labels",
      region: { x: 700, y: 700, w: 200, h: 100 },
    });
    expect(scoreRun([expected({ id: "a" })], [sameTitle], size).found).toHaveLength(1);
  });

  it("matches a whole screen note (no region) by title only", () => {
    const whole = result({ number: 1, region: null, title: "Placeholders are the only labels" });
    expect(scoreRun([expected({ id: "a", box: null })], [whole], size).found).toHaveLength(1);
    const other = result({ number: 2, region: null });
    expect(scoreRun([expected({ id: "a" })], [other], size).found).toEqual([]);
  });

  it("matches each result once: a duplicate note is unexpected", () => {
    const score = scoreRun(
      [expected({ id: "a" })],
      [result({ number: 1 }), result({ number: 2, region: { x: 100, y: 105, w: 200, h: 100 } })],
      size,
    );
    expect(score.found).toHaveLength(1);
    expect(score.unexpected).toHaveLength(1);
  });

  it("pairs the best overlaps when one principle is planted twice", () => {
    const left = expected({
      id: "left",
      principleId: "wcag-2.5.8",
      box: { x: 0, y: 0, w: 50, h: 50 },
    });
    const right = expected({
      id: "right",
      principleId: "wcag-2.5.8",
      box: { x: 500, y: 0, w: 50, h: 50 },
    });
    const score = scoreRun(
      [left, right],
      [
        result({ number: 1, principleId: "wcag-2.5.8", region: { x: 505, y: 0, w: 50, h: 50 } }),
        result({ number: 2, principleId: "wcag-2.5.8", region: { x: 2, y: 0, w: 50, h: 50 } }),
      ],
      size,
    );
    expect(score.found.map((f) => [f.expected.id, f.result.number])).toEqual([
      ["left", 2],
      ["right", 1],
    ]);
  });

  it("a clean case only has unexpected notes", () => {
    const score = scoreRun([], [result({ number: 1 })], size);
    expect(score.found).toEqual([]);
    expect(score.missed).toEqual([]);
    expect(score.unexpected).toHaveLength(1);
  });
});

describe("spread and recall", () => {
  it("gives min, max and mean", () => {
    expect(spread([3, 5, 4])).toEqual({ min: 3, max: 5, mean: 4 });
    expect(spread([])).toEqual({ min: 0, max: 0, mean: 0 });
  });

  it("has no recall when nothing was planted", () => {
    expect(recall(3, 4)).toBe(0.75);
    expect(recall(0, 0)).toBeNull();
  });
});
