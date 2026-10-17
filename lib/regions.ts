/** Region boxes on a screenshot, positioned in percentages so they scale with the image. */
import type { Box } from "./data/types";

export type RegionPosition = { left: string; top: string; width: string; height: string };

function percent(part: number, whole: number): string {
  return `${Math.round((part / whole) * 10000) / 100}%`;
}

/** Clamps the box to the image and returns CSS percentages. */
export function regionPosition(box: Box, width: number, height: number): RegionPosition {
  const x = Math.min(Math.max(box.x, 0), width);
  const y = Math.min(Math.max(box.y, 0), height);
  const w = Math.min(box.w, width - x);
  const h = Math.min(box.h, height - y);
  return {
    left: percent(x, width),
    top: percent(y, height),
    width: percent(w, width),
    height: percent(h, height),
  };
}

/** Corners closer than this (fraction of the image width) would hide each other's badge. */
const SAME_CORNER = 0.02;

/**
 * How many badge widths to shift each region's number badge to the right, so badges of regions
 * that share a top left corner (two checks on the same text line) stay visible and clickable.
 * Input in number order; output in the same order.
 */
export function badgeOffsets(boxes: (Box | null)[], width: number, height: number): number[] {
  const placed: Box[] = [];
  return boxes.map((box) => {
    if (!box) return 0;
    const offset = placed.filter(
      (p) =>
        Math.abs(p.x - box.x) / width < SAME_CORNER && Math.abs(p.y - box.y) / height < SAME_CORNER,
    ).length;
    placed.push(box);
    return offset;
  });
}
