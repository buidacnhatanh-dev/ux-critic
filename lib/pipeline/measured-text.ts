/** Titles, details and fixes for measured issues (docs/04, "Measured issue text"). */
import { formatRatio, toHex, type ColourSuggestion, type Rgb } from "../contrast.ts";

export type IssueText = { title: string; detail: string; fix: string };

const LONG_LABEL = 40;

function cssPx(value: number): string {
  return `${Math.round(value)} px`;
}

export function contrastIssueText(input: {
  label: string;
  ratio: number;
  threshold: number;
  background: Rgb;
  suggestion: ColourSuggestion | null;
}): IssueText {
  const { label, ratio, threshold, background, suggestion } = input;
  const title = label.length > LONG_LABEL ? "Text is too faint" : `"${label}" is too faint`;
  const subject = label.length > LONG_LABEL ? "This text" : `"${label}"`;
  let detail = `${subject} measures ${formatRatio(ratio)} on ${toHex(background)}. Text needs at least ${threshold} : 1.`;
  if (ratio >= 3 && ratio < 4.5) {
    detail += " Bold text from about 19 px only needs 3 : 1, but bold is not detected.";
  }
  const fix = suggestion
    ? `Use ${suggestion.hex} for this text: it measures ${formatRatio(suggestion.ratio)} on ${toHex(background)}.`
    : `Change the text or background colour until the text measures at least ${threshold} : 1.`;
  return { title, detail, fix };
}

export function textSizeIssueText(input: { size: number; threshold: number }): IssueText {
  return {
    title: "Body text is small",
    detail: `About ${cssPx(input.size)}. My checklist asks for at least ${cssPx(input.threshold)}. Estimated from the text line height.`,
    fix: `Use at least ${cssPx(input.threshold)} for body text.`,
  };
}

export function targetSizeIssueText(input: {
  label: string;
  size: number;
  dimension: "tall" | "wide";
  threshold: number;
}): IssueText {
  const { label, size, dimension, threshold } = input;
  const ideally = threshold < 44 ? ", ideally 44 px" : "";
  return {
    title: `"${label}" is too small to tap`,
    detail: `${cssPx(size)} ${dimension}. Targets need at least ${threshold} by ${threshold} px.`,
    fix: `Make it at least ${threshold} px ${dimension}${ideally}.`,
  };
}
