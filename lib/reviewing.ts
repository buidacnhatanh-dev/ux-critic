/** Reviewing and Review failed wording (docs/03, docs/05, docs/06 §9 and §10). Pure. */
import type { ReviewDetail, ReviewStep, SourceSettings } from "./data/types";
import { plural } from "./format";

export const STEPS: ReviewStep[] = ["prepare", "measure", "evaluate", "place"];

export const STEP_LABEL: Record<ReviewStep, string> = {
  prepare: "Screenshot loaded",
  measure: "Measured contrast and sizes",
  evaluate: "Evaluating against principles",
  place: "Placing notes on the screenshot",
};

export type StepState = "done" | "current" | "waiting";

export function stepState(step: ReviewStep, current: ReviewStep, finished: boolean): StepState {
  if (finished) return "done";
  const a = STEPS.indexOf(step);
  const b = STEPS.indexOf(current);
  return a < b ? "done" : a === b ? "current" : "waiting";
}

/** docs/05: "Nielsen, WCAG, Laws of UX and my 6 rules". Counts only enabled rules. */
export function sourcesSummary(sets: SourceSettings, ruleCount: number): string {
  const parts: string[] = [];
  if (sets.nielsen) parts.push("Nielsen");
  if (sets.wcag) parts.push("WCAG");
  if (sets.laws) parts.push("Laws of UX");
  if (sets.mine && ruleCount > 0) parts.push(`my ${plural(ruleCount, "rule")}`);
  if (parts.length === 0) return "No principles selected";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** The second line under each step. Measuring only shows its count once it is done. */
export function stepDetail(
  step: ReviewStep,
  review: ReviewDetail,
  state: StepState,
): string | null {
  switch (step) {
    case "prepare":
      return `${review.version.width} × ${review.version.height} px`;
    case "measure":
      return state === "done"
        ? `${plural(review.issues.filter((i) => i.kind === "measured").length, "problem")} found by measuring`
        : null;
    case "evaluate":
      return sourcesSummary(
        review.sources.sets,
        review.sources.sets.mine ? review.sources.ruleIds.length : 0,
      );
    case "place":
      return null;
  }
}

export type ErrorKind = "restart" | "prepare" | "timeout" | "network" | "key" | "rate" | "unknown";

/** Picks the error type from the stored message, for a human sentence. */
export function errorKind(message: string): ErrorKind {
  if (/app stopped|restarted/i.test(message)) return "restart";
  if (/screenshot couldn.t be prepared/i.test(message)) return "prepare";
  if (/timed?\s*out|timeout/i.test(message)) return "timeout";
  if (/\b401\b|\b403\b|api key|x-api-key|authentication|permission/i.test(message)) return "key";
  if (/\b429\b|rate.?limit|overloaded|\b529\b/i.test(message)) return "rate";
  if (/network|econn|enotfound|fetch failed|socket|offline/i.test(message)) return "network";
  return "unknown";
}

/** The sentence on Review failed. A timeout says the seconds only when the message has them. */
export function errorSentence(message: string): string {
  switch (errorKind(message)) {
    case "prepare":
      return "The screenshot couldn't be read. Export it again as a PNG, JPG or WebP image and start a new review.";
    case "restart":
      return "The app was stopped while this review was running. Measured results are saved, so you can start it again.";
    case "timeout": {
      const seconds = /(\d+)\s*s\b/.exec(message)?.[1];
      return seconds
        ? `Claude didn't answer within ${seconds} seconds. This is usually a slow connection or a busy service.`
        : "Claude didn't answer in time. This is usually a slow connection or a busy service.";
    }
    case "network":
      return "The connection to Claude dropped. Check that this laptop is online, then try again.";
    case "key":
      return "Claude didn't accept the API key. Check the key in .env.local and restart the app.";
    case "rate":
      return "Claude is getting too many requests right now. Wait a minute, then try again.";
    case "unknown":
      return "Something went wrong while talking to Claude.";
  }
}
