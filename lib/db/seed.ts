/** First run data (docs/02): every principle set on and the six rules from the design. */
import type { IssueKind, RuleMetric, SourceSettings } from "../data/types.ts";

export const DEFAULT_SOURCES: SourceSettings = {
  nielsen: true,
  wcag: true,
  laws: true,
  mine: true,
};

export const SEED_RULES: {
  text: string;
  kind: IssueKind;
  metric: RuleMetric | null;
  threshold: number | null;
}[] = [
  {
    text: "Touch targets are at least 44 by 44 px",
    kind: "measured",
    metric: "target_size_min",
    threshold: 44,
  },
  { text: "Body text is at least 16 px", kind: "measured", metric: "text_size_min", threshold: 16 },
  { text: "Every field has a visible label", kind: "evaluated", metric: null, threshold: null },
  { text: "One primary button per screen", kind: "evaluated", metric: null, threshold: null },
  {
    text: "Error messages say how to fix the problem",
    kind: "evaluated",
    metric: null,
    threshold: null,
  },
  {
    text: "Colour is never the only way to show a state",
    kind: "evaluated",
    metric: null,
    threshold: null,
  },
];
