/**
 * The measure step for one screenshot (docs/04): every located text line gets a contrast and a
 * text size check, every located control a target size check. Every check is kept (pass or fail,
 * Compare needs them); failures become measured issues with the wording from docs/04.
 */
import { roundRatio, suggestPassingColour, toHex, type Rgb } from "../contrast.ts";
import {
  WCAG_TARGET_MIN,
  checkTextSize,
  estimateFontSizeFromOcr,
  measureContrast,
  measureTargetSize,
  measureTextSize,
} from "./measure.ts";
import { contrastIssueText, targetSizeIssueText, textSizeIssueText } from "./measured-text.ts";
import type { TextLine } from "./ocr.ts";
import type { PixelBox, RawImage } from "./raw-image.ts";

/**
 * A text line. `fontSize` is an estimate in CSS px made by whoever located the line (OCR);
 * without it the box is taken as a 1.2 line box (demo captures, docs/04).
 */
export type LocatedText = { label: string; box: PixelBox; fontSize?: number };
export type LocatedControl = { label: string; box: PixelBox };

/** OCR lines as measure input, with the text size estimated from the OCR boxes (docs/04). */
export function fromOcr(lines: readonly TextLine[], scale: number): LocatedText[] {
  return lines.map((line) => ({
    label: line.text,
    box: line.box,
    fontSize: estimateFontSizeFromOcr(line.rowHeight, line.box.h, scale),
  }));
}

/** Enabled measured rules from My checklist. A missing rule turns that check off. */
export type MeasuredRules = {
  targetSize: { ruleId: string; min: number } | null;
  textSize: { ruleId: string; min: number } | null;
  contrast: { ruleId: string; min: number } | null;
};

export type ScreenMeasurement = {
  key: string;
  kind: "contrast" | "text_size" | "target_size";
  label: string;
  box: PixelBox;
  value: number;
  threshold: number;
  passes: boolean;
};

export type ScreenMeasuredIssue = {
  measurementKey: string;
  principleId: string;
  title: string;
  detail: string;
  fix: string;
  severity: "high" | "medium" | "low";
  region: PixelBox;
};

export function measureScreen(input: {
  img: RawImage;
  scale: number;
  textLines: LocatedText[];
  controls: LocatedControl[];
  rules: MeasuredRules;
}): { measurements: ScreenMeasurement[]; issues: ScreenMeasuredIssue[] } {
  const { img, scale, rules } = input;
  const measurements: ScreenMeasurement[] = [];
  const issues: ScreenMeasuredIssue[] = [];
  const faintPieces: FaintPiece[] = [];

  input.textLines.forEach((line, i) => {
    const contrast = measureContrast(img, line.box, scale, rules.contrast?.min, line.fontSize);
    if (contrast) {
      const key = `t${i}-contrast`;
      measurements.push({
        key,
        kind: "contrast",
        label: line.label,
        box: line.box,
        value: roundRatio(contrast.ratio),
        threshold: contrast.threshold,
        passes: contrast.passes,
      });
      if (!contrast.passes) {
        const suggestion = suggestPassingColour(
          contrast.text,
          contrast.background,
          contrast.threshold,
        );
        faintPieces.push({
          lineIndex: i,
          label: line.label,
          box: line.box,
          text: contrast.text,
          background: contrast.background,
          ratio: contrast.ratio,
          threshold: contrast.threshold,
          measurementKey: key,
        });
        issues.push({
          measurementKey: key,
          principleId: "wcag-1.4.3",
          severity: contrast.ratio < 3 ? "high" : "medium",
          region: line.box,
          ...contrastIssueText({
            label: line.label,
            ratio: contrast.ratio,
            threshold: contrast.threshold,
            background: contrast.background,
            suggestion,
          }),
        });
      }
    }

    if (rules.textSize) {
      const size =
        line.fontSize === undefined
          ? measureTextSize(line.box.h, scale, line.label, rules.textSize.min)
          : checkTextSize(line.fontSize, line.label, rules.textSize.min);
      const key = `t${i}-size`;
      measurements.push({
        key,
        kind: "text_size",
        label: line.label,
        box: line.box,
        value: size.size,
        threshold: size.threshold,
        passes: size.passes,
      });
      if (!size.passes) {
        issues.push({
          measurementKey: key,
          principleId: `rule:${rules.textSize.ruleId}`,
          severity: "low",
          region: line.box,
          ...textSizeIssueText({ size: size.size, threshold: size.threshold }),
        });
      }
    }
  });

  input.controls.forEach((control, i) => {
    const target = measureTargetSize(img, control.box, scale, rules.targetSize?.min);
    if (!target) return;
    const wcagKey = `c${i}-target`;
    measurements.push({
      key: wcagKey,
      kind: "target_size",
      label: control.label,
      box: target.tight,
      value: target.smaller.size,
      threshold: WCAG_TARGET_MIN,
      passes: target.passesWcag,
    });
    const ruleKey = `c${i}-target-rule`;
    if (rules.targetSize) {
      measurements.push({
        key: ruleKey,
        kind: "target_size",
        label: control.label,
        box: target.tight,
        value: target.smaller.size,
        threshold: rules.targetSize.min,
        passes: target.passesRule,
      });
    }
    // One issue per control: WCAG first, the stricter rule only when WCAG passes.
    if (!target.passesWcag) {
      issues.push({
        measurementKey: wcagKey,
        principleId: "wcag-2.5.8",
        severity: "medium",
        region: target.tight,
        ...targetSizeIssueText({
          label: control.label,
          size: target.smaller.size,
          dimension: target.smaller.dimension,
          threshold: WCAG_TARGET_MIN,
        }),
      });
    } else if (rules.targetSize && !target.passesRule) {
      issues.push({
        measurementKey: ruleKey,
        principleId: `rule:${rules.targetSize.ruleId}`,
        severity: "low",
        region: target.tight,
        ...targetSizeIssueText({
          label: control.label,
          size: target.smaller.size,
          dimension: target.smaller.dimension,
          threshold: rules.targetSize.min,
        }),
      });
    }
  });

  // OCR can split one faint line in two; both measurements stay, but they become one note.
  for (const group of groupFaintPieces(faintPieces, input.textLines)) {
    if (group.length < 2) continue;
    const [first] = group as [FaintPiece, ...FaintPiece[]];
    const keys = new Set(group.map((p) => p.measurementKey));
    const at = issues.findIndex((issue) => keys.has(issue.measurementKey));
    const merged: ScreenMeasuredIssue = {
      measurementKey: first.measurementKey,
      principleId: "wcag-1.4.3",
      severity: first.ratio < 3 ? "high" : "medium",
      region: unionBox(group.map((p) => p.box)),
      ...contrastIssueText({
        label: group.map((p) => p.label).join(" … "),
        ratio: first.ratio,
        threshold: first.threshold,
        background: first.background,
        suggestion: suggestPassingColour(first.text, first.background, first.threshold),
      }),
    };
    const rest = issues.filter((issue) => !keys.has(issue.measurementKey));
    rest.splice(Math.min(at, rest.length), 0, merged);
    issues.splice(0, issues.length, ...rest);
  }

  return { measurements, issues };
}

/** A text line that failed contrast, with what it measured. */
export type FaintPiece = {
  lineIndex: number;
  label: string;
  box: PixelBox;
  text: Rgb;
  background: Rgb;
  ratio: number;
  threshold: number;
  measurementKey: string;
};

/** Same baseline: the boxes overlap vertically by at least this share of the smaller height. */
export const SAME_BASELINE_OVERLAP = 0.6;

function sameBaseline(a: PixelBox, b: PixelBox): boolean {
  const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return overlap >= SAME_BASELINE_OVERLAP * Math.min(a.h, b.h);
}

function unionBox(boxes: PixelBox[]): PixelBox {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * Faint pieces that are one element split by OCR, left to right. Two neighbours join only when
 * they sit on the same baseline, measured the same text colour, background and ratio, and no other
 * text line lies between them. Everything else stays a group of one. Pure.
 */
export function groupFaintPieces(
  pieces: readonly FaintPiece[],
  lines: readonly { box: PixelBox }[],
): FaintPiece[][] {
  const sorted = [...pieces].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const groups: FaintPiece[][] = [];
  for (const piece of sorted) {
    const group = groups.find((g) => {
      const last = g.at(-1)!;
      const [left, right] = last.box.x <= piece.box.x ? [last, piece] : [piece, last];
      const gapStart = left.box.x + left.box.w;
      const gapEnd = right.box.x;
      const between = lines.some(
        (line, i) =>
          i !== left.lineIndex &&
          i !== right.lineIndex &&
          sameBaseline(line.box, left.box) &&
          line.box.x < gapEnd &&
          line.box.x + line.box.w > gapStart,
      );
      return (
        sameBaseline(last.box, piece.box) &&
        toHex(last.text) === toHex(piece.text) &&
        toHex(last.background) === toHex(piece.background) &&
        roundRatio(last.ratio) === roundRatio(piece.ratio) &&
        !between
      );
    });
    if (group) group.push(piece);
    else groups.push([piece]);
  }
  return groups;
}
