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

/**
 * Corners closer than this, as a fraction of the image width in both directions (the image scales
 * evenly), would put the 24 px badges on top of each other. 8 % keeps them apart down to an image
 * about 300 px wide, as on a phone.
 */
const SAME_CORNER = 0.08;

/**
 * Where each region's number badge goes. Badges whose top left corners are close (two checks on
 * the same text line, a note just above a measured line) form a group: they sit on the first
 * corner of the group, one badge width apart, so each stays visible and clickable at any image
 * size. `offset` is how many badge widths to the right; `anchor` is the group's corner relative to
 * this box, as a percentage of the box (null when the badge sits on its own corner). Input in
 * number order; output in the same order.
 */
export type BadgePlacement = { offset: number; anchor: { left: string; top: string } | null };

export function badgePlacements(boxes: (Box | null)[], width: number): BadgePlacement[] {
  const groups: { corner: { x: number; y: number }; size: number }[] = [];
  return boxes.map((box) => {
    if (!box) return { offset: 0, anchor: null };
    const near = (p: { x: number; y: number }) =>
      Math.abs(p.x - box.x) / width < SAME_CORNER && Math.abs(p.y - box.y) / width < SAME_CORNER;
    const group = groups.find((g) => near(g.corner));
    if (!group) {
      groups.push({ corner: { x: box.x, y: box.y }, size: 1 });
      return { offset: 0, anchor: null };
    }
    const offset = group.size++;
    const { x, y } = group.corner;
    if (x === box.x && y === box.y) return { offset, anchor: null };
    return {
      offset,
      anchor: { left: percent(x - box.x, box.w), top: percent(y - box.y, box.h) },
    };
  });
}
