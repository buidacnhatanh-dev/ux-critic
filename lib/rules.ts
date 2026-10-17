/** Own rule fields shared by Add a rule and Edit rule (docs/02 rules, docs/06 §6 and §14). */
import type { IssueKind, RuleMetric } from "./data/types";

export const METRIC_OPTIONS: { value: RuleMetric; label: string; unit: string }[] = [
  { value: "target_size_min", label: "Target size at least", unit: "px" },
  { value: "text_size_min", label: "Text size at least", unit: "px" },
  { value: "contrast_min", label: "Contrast at least", unit: ": 1" },
];

export const DEFAULT_THRESHOLD: Record<RuleMetric, number> = {
  target_size_min: 44,
  text_size_min: 16,
  contrast_min: 4.5,
};

export type RuleDraft = { text: string; kind: IssueKind; metric: RuleMetric; threshold: string };

export type RuleErrors = { text?: string; threshold?: string };

/** Errors for a rule draft, checked on submit. */
export function ruleErrors(draft: RuleDraft): RuleErrors {
  const errors: RuleErrors = {};
  if (!draft.text.trim()) errors.text = "Write the rule, for example: never more than 2 typefaces.";
  if (draft.kind === "measured") {
    const value = Number(draft.threshold);
    if (draft.threshold.trim() === "" || !Number.isFinite(value) || value <= 0) {
      errors.threshold = "Enter a number above 0, for example 44.";
    }
  }
  return errors;
}

/** The fields to save: evaluated rules keep no metric or threshold. */
export function ruleFields(draft: RuleDraft) {
  const measured = draft.kind === "measured";
  return {
    text: draft.text.trim(),
    kind: draft.kind,
    metric: measured ? draft.metric : null,
    threshold: measured ? Number(draft.threshold) : null,
  };
}
