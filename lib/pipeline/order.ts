/** Reading order for issue numbers: top to bottom, then left to right (docs/02). */

type WithRegion = { region: { x: number; y: number } | null };

/** Regions whose tops are this close (image px) count as one row. */
export const SAME_ROW_PX = 8;

export function compareReadingOrder(a: WithRegion, b: WithRegion): number {
  if (!a.region || !b.region) return a.region ? -1 : b.region ? 1 : 0;
  const dy = a.region.y - b.region.y;
  if (Math.abs(dy) > SAME_ROW_PX) return dy;
  return a.region.x - b.region.x;
}

/** Sorts a copy and numbers it 1…n. Issues without a region (whole screen) come last. */
export function numberInReadingOrder<T extends WithRegion>(
  issues: T[],
): (T & { number: number })[] {
  return [...issues].sort(compareReadingOrder).map((issue, i) => ({ ...issue, number: i + 1 }));
}
