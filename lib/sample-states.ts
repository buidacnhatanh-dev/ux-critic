/**
 * Sample data for /states (docs/10): the Review failed and Evaluation unreadable screens can't
 * happen in the public demo, so they are shown with a prepared review changed into that state.
 * Clearly marked as samples on the page; nothing here is saved.
 */
import type { ReviewDetail } from "./data/types";

export const SAMPLE_TIMEOUT_MESSAGE = "Request timed out after 60 s";

/** The review stopped while evaluating; measured checks had finished. */
export function failedSample(review: ReviewDetail): ReviewDetail {
  return {
    ...review,
    id: `sample-failed:${review.id}`,
    status: "failed",
    step: "evaluate",
    finishedAt: null,
    error: { message: SAMPLE_TIMEOUT_MESSAGE, detail: "Sample error for the screen states page." },
    issues: [],
  };
}

/** Only the measured issues, numbered again in reading order, as place would do. */
export function partialSample(review: ReviewDetail): ReviewDetail {
  const measured = review.issues
    .filter((i) => i.kind === "measured")
    .sort((a, b) => a.number - b.number)
    .map((issue, index) => ({
      ...issue,
      id: `sample:${issue.id}`,
      number: index + 1,
      pushback: null,
    }));
  return {
    ...review,
    id: `sample-partial:${review.id}`,
    status: "partial",
    error: { message: "The evaluation answer could not be read.", detail: null },
    issues: measured,
  };
}
