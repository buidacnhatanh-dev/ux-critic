/**
 * Scoring of the measured checks alone (`pnpm eval:measured`): no Claude call, so it runs without
 * a key. Pure parts only; the script does the OCR and the measuring.
 */
import type { MeasuredRules } from "../pipeline/measure-screen.ts";
import { SEED_RULES } from "../db/seed.ts";
import { RULE_KEYS } from "./rule-keys.ts";
import type { ExpectedIssue, RunScore } from "./score.ts";

export type MeasuredCheck = "contrast" | "text_size" | "target_size";

export const CHECKS: MeasuredCheck[] = ["contrast", "text_size", "target_size"];

/** Which check a measured principle belongs to. */
export function checkOf(principleId: string): MeasuredCheck | null {
  if (principleId === "wcag-1.4.3") return "contrast";
  if (principleId === "rule:body-text-16") return "text_size";
  if (principleId === "wcag-2.5.8" || principleId === "rule:targets-44") return "target_size";
  return null;
}

/**
 * The measured rules of a first run checklist (every seed rule on), with the rule keys as ids so
 * rule issues come out as `rule:<key>` like the cases expect.
 */
export function seedMeasuredRules(): MeasuredRules {
  const pick = (metric: string) => {
    const rule = SEED_RULES.find((r) => r.metric === metric);
    const key = rule ? RULE_KEYS[rule.text] : undefined;
    return rule && key && rule.threshold !== null ? { ruleId: key, min: rule.threshold } : null;
  };
  return {
    targetSize: pick("target_size_min"),
    textSize: pick("text_size_min"),
    contrast: pick("contrast_min"),
  };
}

export type CheckTally = { planted: number; found: number; unexpected: number };

/** Found, planted and unexpected per check, over any number of scored cases. */
export function tallyByCheck(
  scores: readonly { expected: readonly ExpectedIssue[]; score: RunScore }[],
): Record<MeasuredCheck, CheckTally> {
  const tally = Object.fromEntries(
    CHECKS.map((c) => [c, { planted: 0, found: 0, unexpected: 0 }]),
  ) as Record<MeasuredCheck, CheckTally>;
  for (const { expected, score } of scores) {
    for (const e of expected) {
      const check = checkOf(e.principleId);
      if (check) tally[check].planted++;
    }
    for (const f of score.found) {
      const check = checkOf(f.expected.principleId);
      if (check) tally[check].found++;
    }
    for (const u of score.unexpected) {
      const check = checkOf(u.principleId);
      if (check) tally[check].unexpected++;
    }
  }
  return tally;
}
