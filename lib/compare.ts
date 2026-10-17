/**
 * Issue matching between two versions (docs/07-compare.md). Pure, no data access.
 * Works on the latest finished review of each version.
 */
import type { Box, Issue, Measurement, MeasurementKind } from "./data/types";

/** Box as fractions 0…1 of the image, so versions with different sizes can be compared. */
export type NormalBox = { x: number; y: number; w: number; h: number };

export type CompareSide = {
  width: number;
  height: number;
  issues: Issue[];
  measurements: Measurement[];
};

export type ValueChange = {
  kind: MeasurementKind;
  before: number;
  /** Null when no matching measurement exists in "to": "no longer found". Never invented. */
  after: number | null;
};

export type FixedItem = { issue: Issue; change: ValueChange | null };
export type OpenItem = { from: Issue; to: Issue };

export type CompareResult = {
  fixed: FixedItem[];
  stillOpen: OpenItem[];
  added: Issue[];
};

export const IOU_MIN = 0.25;
export const TITLE_SIMILARITY_MIN = 0.5;

export function normaliseBox(box: Box, width: number, height: number): NormalBox {
  return { x: box.x / width, y: box.y / height, w: box.w / width, h: box.h / height };
}

/** Intersection over union of two boxes in the same units. 0 when either is empty. */
export function iou(a: NormalBox, b: NormalBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - intersection;
  return union > 0 ? intersection / union : 0;
}

/** Lower case, punctuation removed, split on white space. */
export function titleTokens(title: string): Set<string> {
  const cleaned = title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  return new Set(cleaned.split(/\s+/).filter(Boolean));
}

/** Token Jaccard similarity of two titles, 0…1. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 && tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/**
 * Score of a candidate pair, or null when the two issues do not match: same principle, and
 * either region IoU ≥ 0.25 or (a region is null or the IoU test fails) title similarity ≥ 0.5.
 */
export function matchScore(from: Issue, fromSide: Size, to: Issue, toSide: Size): number | null {
  if (from.principleId !== to.principleId) return null;
  const overlap =
    from.region && to.region
      ? iou(
          normaliseBox(from.region, fromSide.width, fromSide.height),
          normaliseBox(to.region, toSide.width, toSide.height),
        )
      : 0;
  const similarity = titleSimilarity(from.title, to.title);
  if (overlap >= IOU_MIN || similarity >= TITLE_SIMILARITY_MIN) return overlap + similarity;
  return null;
}

type Size = { width: number; height: number };

/**
 * Greedy matching: score all candidate pairs, take the best, remove both, repeat.
 * Ties go to the lower issue numbers, so the result does not depend on input order.
 */
export function matchIssues(from: CompareSide, to: CompareSide): OpenItem[] {
  const candidates: { from: Issue; to: Issue; score: number }[] = [];
  for (const a of from.issues) {
    for (const b of to.issues) {
      const score = matchScore(a, from, b, to);
      if (score !== null) candidates.push({ from: a, to: b, score });
    }
  }
  candidates.sort(
    (p, q) => q.score - p.score || p.from.number - q.from.number || p.to.number - q.to.number,
  );
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();
  const pairs: OpenItem[] = [];
  for (const c of candidates) {
    if (usedFrom.has(c.from.id) || usedTo.has(c.to.id)) continue;
    usedFrom.add(c.from.id);
    usedTo.add(c.to.id);
    pairs.push({ from: c.from, to: c.to });
  }
  return pairs;
}

/**
 * For a fixed measured issue: the measurement of the same kind in "to" whose normalised box
 * overlaps (IoU ≥ 0.25) or whose label matches exactly. Best overlap wins.
 */
export function valueChange(issue: Issue, from: CompareSide, to: CompareSide): ValueChange | null {
  if (issue.kind !== "measured" || !issue.measurementId) return null;
  const before = from.measurements.find((m) => m.id === issue.measurementId);
  if (!before) return null;
  const beforeBox = normaliseBox(before.box, from.width, from.height);
  let best: { m: Measurement; score: number } | null = null;
  for (const m of to.measurements) {
    if (m.kind !== before.kind) continue;
    const overlap = iou(beforeBox, normaliseBox(m.box, to.width, to.height));
    const sameLabel = m.label.trim() !== "" && m.label === before.label;
    if (overlap < IOU_MIN && !sameLabel) continue;
    const score = overlap + (sameLabel ? 1 : 0);
    if (!best || score > best.score) best = { m, score };
  }
  return { kind: before.kind, before: before.value, after: best ? best.m.value : null };
}

export function compareReviews(from: CompareSide, to: CompareSide): CompareResult {
  const pairs = matchIssues(from, to);
  const matchedFrom = new Set(pairs.map((p) => p.from.id));
  const matchedTo = new Set(pairs.map((p) => p.to.id));
  const byNumber = (a: Issue, b: Issue) => a.number - b.number;
  return {
    fixed: from.issues
      .filter((i) => !matchedFrom.has(i.id))
      .sort(byNumber)
      .map((issue) => ({ issue, change: valueChange(issue, from, to) })),
    stillOpen: pairs.sort((p, q) => p.to.number - q.to.number),
    added: to.issues.filter((i) => !matchedTo.has(i.id)).sort(byNumber),
  };
}
