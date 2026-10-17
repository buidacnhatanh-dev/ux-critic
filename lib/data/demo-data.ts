import data from "@/demo/data.json";
import type { ReviewSource } from "./types";

type DemoReviewRecord = { source?: ReviewSource };

/** Sources of all prepared reviews, for the demo badge. The full typed loader comes in M1. */
export function demoReviewSources(): ReviewSource[] {
  const reviews = (data as { reviews: DemoReviewRecord[] }).reviews;
  return reviews.flatMap((review) => (review.source ? [review.source] : []));
}
