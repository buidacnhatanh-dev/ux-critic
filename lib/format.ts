/** Wording and number formats shared by the screens. Every number shown comes from data. */
import type { MeasurementKind, ReviewDetail, SourceSettings } from "./data/types";

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** "14 Oct" */
export function shortDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso));
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Trimmed to two decimals without trailing zeros: 1.85, 13, 10.5. */
function number(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** "1.85 : 1", "13 px". Target sizes are the smaller side in CSS px (docs/04). */
export function measurementValue(kind: MeasurementKind, value: number): string {
  return kind === "contrast" ? `${number(value)} : 1` : `${number(value)} px`;
}

/** "was 1.85 : 1, now 7.2 : 1" or "was 1.85 : 1, no longer found" (docs/07). */
export function valueChangeText(kind: MeasurementKind, before: number, after: number | null) {
  const was = `was ${measurementValue(kind, before)}`;
  return after === null
    ? `${was}, no longer found`
    : `${was}, now ${measurementValue(kind, after)}`;
}

export type Trend = { text: string; tone: "better" | "worse" | "same" };

/** Trend line on a project card: "3 fewer issues than v1". */
export function trend(latest: number, previous: number, previousName: string): Trend {
  const diff = latest - previous;
  if (diff < 0)
    return {
      text: `${plural(-diff, "fewer issue", "fewer issues")} than ${previousName}`,
      tone: "better",
    };
  if (diff > 0)
    return {
      text: `${plural(diff, "more issue", "more issues")} than ${previousName}`,
      tone: "worse",
    };
  return { text: `Same number of issues as ${previousName}`, tone: "same" };
}

/** "4 issues · 1 I disagreed with · reviewed 13 Oct" */
export function reviewSummary(
  issueCount: number,
  pushbackCount: number,
  finishedAt: string | null,
): string {
  const parts = [plural(issueCount, "issue")];
  if (pushbackCount > 0) parts.push(`${pushbackCount} I disagreed with`);
  if (finishedAt) parts.push(`reviewed ${shortDate(finishedAt)}`);
  return parts.join(" · ");
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * "Nielsen's heuristics, WCAG 2.2, the Laws of UX and your 6 rules" for No issues found.
 * Counts only the rules that were on for this review.
 */
export function checkedAgainst(sets: SourceSettings, ruleCount: number): string {
  const parts: string[] = [];
  if (sets.nielsen) parts.push("Nielsen's heuristics");
  if (sets.wcag) parts.push("WCAG 2.2");
  if (sets.laws) parts.push("the Laws of UX");
  if (sets.mine && ruleCount > 0) parts.push(`your ${plural(ruleCount, "rule")}`);
  return parts.length ? joinAnd(parts) : "measured checks only";
}

/** Latest finished review counts as reviewed (done or partial; docs/07). */
export function isFinished(status: ReviewDetail["status"] | null): boolean {
  return status === "done" || status === "partial";
}

export type Prices = { inputPerM: number; outputPerM: number };

/** "€0.42", "less than €0.01", from saved token counts and the prices in .env.local. */
export function spendText(usage: { input: number; output: number }, prices: Prices): string {
  const euros = (usage.input * prices.inputPerM + usage.output * prices.outputPerM) / 1_000_000;
  if (euros > 0 && euros < 0.005) return "less than €0.01";
  return `€${euros.toFixed(2)}`;
}
