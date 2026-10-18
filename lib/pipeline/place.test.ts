import type { EvaluatedIssue } from "./evaluate";
import { clampBox, iou, isDuplicate, placeIssues, type MeasuredForPlacing } from "./place";

const evaluated = (overrides: Partial<EvaluatedIssue> = {}): EvaluatedIssue => ({
  principleId: "nielsen-8",
  title: "Evaluated",
  detail: "d",
  fix: "f",
  severity: "medium",
  confidence: "medium",
  region: { x: 10, y: 10, w: 100, h: 20 },
  ...overrides,
});

const measured = (overrides: Partial<MeasuredForPlacing> = {}): MeasuredForPlacing => ({
  principleId: "wcag-1.4.3",
  title: "Measured",
  detail: "d",
  fix: "f",
  severity: "high",
  measurementId: "m1",
  region: { x: 20, y: 20, w: 200, h: 40 },
  ...overrides,
});

describe("iou", () => {
  it("is 1 for the same box, 0 apart, and the overlap share otherwise", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 20, y: 20, w: 10, h: 10 })).toBe(0);
    expect(iou(a, { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(50 / 150);
  });
});

describe("clampBox", () => {
  it("keeps boxes inside the image in whole pixels", () => {
    expect(clampBox({ x: -5, y: 90, w: 20, h: 30 }, 100, 100)).toEqual({
      x: 0,
      y: 90,
      w: 15,
      h: 10,
    });
    expect(clampBox({ x: 120, y: 0, w: 10, h: 10 }, 100, 100)).toBeNull();
  });
});

describe("placeIssues", () => {
  it("maps evaluated boxes to original pixels with the factor", () => {
    const [issue] = placeIssues({
      measured: [],
      evaluated: [evaluated({ region: { x: 100, y: 50, w: 40, h: 20 } })],
      factor: 2,
      width: 2560,
      height: 1600,
    });
    expect(issue!.region).toEqual({ x: 200, y: 100, w: 80, h: 40 });
    expect(issue!.kind).toBe("evaluated");
    expect(issue!.confidence).toBe("medium");
  });

  it("clamps mapped boxes to the original image", () => {
    const [issue] = placeIssues({
      measured: [],
      evaluated: [evaluated({ region: { x: 1200, y: 700, w: 80, h: 100 } })],
      factor: 2,
      width: 2500,
      height: 1500,
    });
    expect(issue!.region).toEqual({ x: 2400, y: 1400, w: 100, h: 100 });
  });

  it("drops an evaluated duplicate of a measured WCAG issue (IoU ≥ 0.3)", () => {
    const placed = placeIssues({
      measured: [measured()],
      evaluated: [
        evaluated({ principleId: "wcag-1.4.3", region: { x: 25, y: 22, w: 190, h: 36 } }),
        evaluated({ principleId: "nielsen-8", region: { x: 25, y: 22, w: 190, h: 36 } }),
      ],
      factor: 1,
      width: 1000,
      height: 1000,
    });
    expect(placed.map((p) => p.principleId)).toEqual(["wcag-1.4.3", "nielsen-8"]);
    expect(placed.map((p) => p.kind)).toEqual(["measured", "evaluated"]);
  });

  it("keeps the same WCAG principle in another place", () => {
    const placed = placeIssues({
      measured: [measured()],
      evaluated: [
        evaluated({ principleId: "wcag-1.4.3", region: { x: 600, y: 600, w: 50, h: 20 } }),
      ],
      factor: 1,
      width: 1000,
      height: 1000,
    });
    expect(placed).toHaveLength(2);
  });

  it("numbers top to bottom, then left to right, whole screen notes last", () => {
    const placed = placeIssues({
      measured: [measured({ region: { x: 500, y: 300, w: 50, h: 20 } })],
      evaluated: [
        evaluated({ title: "whole", region: null }),
        evaluated({ title: "right", region: { x: 600, y: 10, w: 50, h: 20 } }),
        evaluated({ title: "left", region: { x: 10, y: 12, w: 50, h: 20 } }),
      ],
      factor: 1,
      width: 1000,
      height: 1000,
    });
    expect(placed.map((p) => [p.number, p.title])).toEqual([
      [1, "left"],
      [2, "right"],
      [3, "Measured"],
      [4, "whole"],
    ]);
  });
});

describe("isDuplicate", () => {
  it("only applies to WCAG principles with a region", () => {
    const m = [{ ...measured(), kind: "measured" as const, confidence: null }];
    const base = {
      kind: "evaluated" as const,
      measurementId: null,
      title: "t",
      detail: "d",
      fix: "f",
    };
    expect(
      isDuplicate(
        { ...base, principleId: "wcag-1.4.3", severity: "high", confidence: "high", region: null },
        m,
      ),
    ).toBe(false);
  });
});
