/**
 * The measure step for one screenshot (docs/04): every located text line gets a contrast and a
 * text size check, every located control a target size check. Every check is kept (pass or fail,
 * Compare needs them); failures become measured issues with the wording from docs/04.
 */
import { roundRatio, suggestPassingColour } from "../contrast.ts";
import {
  WCAG_TARGET_MIN,
  checkTextSize,
  measureContrast,
  measureTargetSize,
  measureTextSize,
} from "./measure.ts";
import { contrastIssueText, targetSizeIssueText, textSizeIssueText } from "./measured-text.ts";
import type { PixelBox, RawImage } from "./raw-image.ts";

/**
 * A text line. `fontSize` is an estimate in CSS px made by whoever located the line (OCR);
 * without it the box is taken as a 1.2 line box (demo captures, docs/04).
 */
export type LocatedText = { label: string; box: PixelBox; fontSize?: number };
export type LocatedControl = { label: string; box: PixelBox };

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

  return { measurements, issues };
}
