/**
 * Placing notes (docs/03 "Placing notes"): evaluated boxes back to original pixels, clamped,
 * evaluated duplicates of measured WCAG issues dropped, everything numbered in reading order.
 * Pure.
 */
import type { Box, Confidence, Severity } from "../data/types.ts";
import type { EvaluatedIssue } from "./evaluate.ts";
import { toOriginal } from "./image.ts";
import { numberInReadingOrder } from "./order.ts";

export const DUPLICATE_IOU = 0.3;

export type PlacedIssue = {
  kind: "measured" | "evaluated";
  principleId: string;
  title: string;
  detail: string;
  fix: string;
  severity: Severity;
  confidence: Confidence | null;
  measurementId: string | null;
  region: Box | null;
};

export type MeasuredForPlacing = Omit<PlacedIssue, "kind" | "confidence"> & {
  measurementId: string;
};

export function iou(a: Box, b: Box): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const overlap = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.w * a.h + b.w * b.h - overlap;
  return union > 0 ? overlap / union : 0;
}

/** Whole pixels inside the image; null when nothing is left. */
export function clampBox(box: Box, width: number, height: number): Box | null {
  const x0 = Math.max(0, Math.round(box.x));
  const y0 = Math.max(0, Math.round(box.y));
  const x1 = Math.min(width, Math.round(box.x + box.w));
  const y1 = Math.min(height, Math.round(box.y + box.h));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const isWcag = (principleId: string) => principleId.startsWith("wcag-");

/** An evaluated issue that repeats a measured one: same WCAG principle, boxes overlap enough. */
export function isDuplicate(evaluated: PlacedIssue, measured: PlacedIssue[]): boolean {
  if (!isWcag(evaluated.principleId) || !evaluated.region) return false;
  return measured.some(
    (m) =>
      m.principleId === evaluated.principleId &&
      m.region !== null &&
      iou(m.region, evaluated.region!) >= DUPLICATE_IOU,
  );
}

export function placeIssues(input: {
  measured: MeasuredForPlacing[];
  evaluated: EvaluatedIssue[];
  /** original / sent, from the image preparation. */
  factor: number;
  width: number;
  height: number;
}): (PlacedIssue & { number: number })[] {
  const { width, height, factor } = input;
  const measured: PlacedIssue[] = input.measured.map((m) => ({
    ...m,
    kind: "measured",
    confidence: null,
    region: m.region ? clampBox(m.region, width, height) : null,
  }));
  const evaluated: PlacedIssue[] = input.evaluated.map((e) => ({
    kind: "evaluated",
    principleId: e.principleId,
    title: e.title,
    detail: e.detail,
    fix: e.fix,
    severity: e.severity,
    confidence: e.confidence,
    measurementId: null,
    region: e.region ? clampBox(toOriginal(e.region, factor), width, height) : null,
  }));
  const kept = evaluated.filter((e) => !isDuplicate(e, measured));
  return numberInReadingOrder([...measured, ...kept]);
}
