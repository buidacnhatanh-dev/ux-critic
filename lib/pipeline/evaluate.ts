/**
 * Claude call 2 (docs/03 "Claude call 2: evaluate"): the prompt, the output schema with the
 * enabled principle ids, and zod validation of the answer. Prompt building and parsing are pure.
 */
import { z } from "zod";
import type { Confidence, Rule, Severity, SourceSettings } from "../data/types.ts";
import { PRINCIPLES } from "../principles.ts";
import type { ClaudeImage } from "./image.ts";

export const MAX_EVALUATED_ISSUES = 8;
/** Room for adaptive thinking plus the JSON answer (docs/03 asks for 4000 for the answer). */
export const EVALUATE_MAX_TOKENS = 16_000;

/** Prompt limits are 8, 40 and 30 words; longer text is trimmed, not refused. */
export const WORD_LIMITS = { title: 12, detail: 60, fix: 45 } as const;

export type PromptPrinciple = { id: string; line: string };

/** Principles and evaluated rules that may be used, in catalogue order. */
export function enabledPrinciples(sets: SourceSettings, rules: Rule[]): PromptPrinciple[] {
  const list: PromptPrinciple[] = PRINCIPLES.filter((p) => sets[p.source]).map((p) => ({
    id: p.id,
    line: `${p.id}: ${p.name}: ${p.meaning}`,
  }));
  if (sets.mine) {
    for (const rule of rules) {
      if (rule.enabled && rule.kind === "evaluated") {
        list.push({ id: `rule:${rule.id}`, line: `rule:${rule.id}: ${rule.text}` });
      }
    }
  }
  return list;
}

export function systemPrompt(principles: PromptPrinciple[]): string {
  return [
    "You are a senior UX designer reviewing one screen. You evaluate it against named principles only.",
    "",
    "Principles you may use (id: name: what it means):",
    ...principles.map((p) => p.line),
    "",
    "Rules for your notes:",
    "1. Only report problems you can see in this screenshot. If something is fine, say nothing about it.",
    "2. Every note uses exactly one principle id from the list.",
    `3. At most ${MAX_EVALUATED_ISSUES} notes. Prefer fewer, more important notes.`,
    "4. Severity: high = blocks or misleads people, medium = slows people down or causes errors, low = polish.",
    "5. Confidence: high = clearly visible, medium = likely but depends on context you cannot see, low = a guess.",
    "6. Do not repeat problems that were already measured (listed below).",
    "7. Region: the smallest box in pixels of this image that shows the problem. Use null only if the problem is the whole screen.",
    "8. Plain language. Title under 8 words. Detail under 40 words. One concrete fix under 30 words.",
    "9. If you find no problems, return an empty list.",
  ].join("\n");
}

export type FailingMeasurement = { kind: string; label: string; value: number; threshold: number };

/** One failing measurement: kind, label, value, threshold (docs/03), with units. */
function measuredLine(m: FailingMeasurement): string {
  const unit = (n: number) => (m.kind === "contrast" ? `${n} : 1` : `${n} px`);
  return `${m.kind}, "${m.label}", ${unit(Math.round(m.value * 100) / 100)}, needs ${unit(m.threshold)}`;
}

export function userText(context: string, measured: FailingMeasurement[]): string {
  const lines = measured.map(measuredLine);
  return [
    `What this screen is for: ${context.trim() || "Not given"}`,
    "Already measured (do not repeat):",
    ...(lines.length ? lines : ["Nothing"]),
  ].join("\n");
}

/** The output schema. Structured outputs take no numeric limits; zod checks those afterwards. */
export function outputSchema(principleIds: string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            principle_id: { type: "string", enum: principleIds },
            title: { type: "string" },
            detail: { type: "string" },
            fix: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            region: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  properties: {
                    x: { type: "integer" },
                    y: { type: "integer" },
                    width: { type: "integer" },
                    height: { type: "integer" },
                  },
                  required: ["x", "y", "width", "height"],
                  additionalProperties: false,
                },
              ],
            },
          },
          required: ["principle_id", "title", "detail", "fix", "severity", "confidence", "region"],
          additionalProperties: false,
        },
      },
    },
    required: ["issues"],
    additionalProperties: false,
  };
}

export function evaluateContent(image: ClaudeImage, text: string) {
  return [
    {
      type: "image" as const,
      source: { type: "base64" as const, media_type: image.mediaType, data: image.base64 },
    },
    { type: "text" as const, text },
  ];
}

// Validation

/** Box in pixels of the image Claude received. */
export type SentBox = { x: number; y: number; w: number; h: number };

export type EvaluatedIssue = {
  principleId: string;
  title: string;
  detail: string;
  fix: string;
  severity: Severity;
  confidence: Confidence;
  region: SentBox | null;
};

/** The answer could not be read at all: the review becomes partial (docs/03). */
export class EvaluationUnreadableError extends Error {
  constructor(
    reason: string,
    readonly raw: string,
  ) {
    super(reason);
    this.name = "EvaluationUnreadableError";
  }
}

const level = z.enum(["high", "medium", "low"]);
const text = z.string().trim().min(1);
const itemSchema = z.object({
  principle_id: z.string(),
  title: text,
  detail: text,
  fix: text,
  severity: level,
  confidence: level,
  region: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .nullable(),
});
const answerSchema = z.object({ issues: z.array(z.unknown()) });

/** Cuts text to `limit` words and ends it with "…". */
export function trimWords(value: string, limit: number): string {
  const words = value.trim().split(/\s+/);
  if (words.length <= limit) return words.join(" ");
  return `${words
    .slice(0, limit)
    .join(" ")
    .replace(/[\s,;:.–-]+$/, "")}…`;
}

/** Clamps a box to the image. Null when it lies outside or is thinner than 1 px. */
export function clampToImage(
  box: { x: number; y: number; width: number; height: number },
  size: { width: number; height: number },
): SentBox | null {
  const x0 = Math.max(0, Math.round(box.x));
  const y0 = Math.max(0, Math.round(box.y));
  const x1 = Math.min(size.width, Math.round(box.x + box.width));
  const y1 = Math.min(size.height, Math.round(box.y + box.height));
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export type ParsedEvaluation = { issues: EvaluatedIssue[]; dropped: number };

/**
 * Reads call 2's answer. Bad items are dropped (unknown principle, empty text, box outside the
 * image), long text is trimmed, at most 8 are kept. Throws EvaluationUnreadableError when the text
 * is not the expected JSON or every item was invalid.
 */
export function parseEvaluation(
  raw: string,
  options: { allowedIds: string[]; size: { width: number; height: number } },
): ParsedEvaluation {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new EvaluationUnreadableError("The answer is not JSON.", raw);
  }
  const answer = answerSchema.safeParse(json);
  if (!answer.success) throw new EvaluationUnreadableError("The answer has no issues list.", raw);

  const allowed = new Set(options.allowedIds);
  const issues: EvaluatedIssue[] = [];
  for (const item of answer.data.issues) {
    const parsed = itemSchema.safeParse(item);
    if (!parsed.success || !allowed.has(parsed.data.principle_id)) continue;
    const { region } = parsed.data;
    const box = region ? clampToImage(region, options.size) : null;
    if (region && !box) continue;
    issues.push({
      principleId: parsed.data.principle_id,
      title: trimWords(parsed.data.title, WORD_LIMITS.title),
      detail: trimWords(parsed.data.detail, WORD_LIMITS.detail),
      fix: trimWords(parsed.data.fix, WORD_LIMITS.fix),
      severity: parsed.data.severity,
      confidence: parsed.data.confidence,
      region: box,
    });
  }
  const total = answer.data.issues.length;
  if (total > 0 && issues.length === 0) {
    throw new EvaluationUnreadableError("None of the notes in the answer were valid.", raw);
  }
  const kept = issues.slice(0, MAX_EVALUATED_ISSUES);
  return { issues: kept, dropped: total - kept.length };
}
