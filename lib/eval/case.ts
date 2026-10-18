/**
 * An evaluation case (docs/08): a screenshot in eval/cases/<name>.png and this JSON next to it
 * with the expected issues and their boxes in image pixels. `pnpm eval:capture` writes one per
 * fixture; the owner can add real cases by hand with the same shape (without `controls`).
 */
import { z } from "zod";

const box = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const evalCaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  /** Sent as the version context, like the owner would type it. Never names the planted problems. */
  context: z.string().default(""),
  source: z.enum(["fixture", "manual"]).default("manual"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scale: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  issues: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(["measured", "evaluated"]),
      /** A principle id from docs/05, or `rule:<key>` for a seed rule (lib/eval/rule-keys.ts). */
      principle_id: z.string().min(1),
      note: z.string().default(""),
      box: box.nullable(),
    }),
  ),
  /**
   * Fixtures only: every interactive element, located from the page when it was captured. Used by
   * `pnpm eval:measured` in place of Claude call 1, which needs a key.
   */
  controls: z.array(z.object({ label: z.string(), box })).optional(),
});

export type EvalCase = z.infer<typeof evalCaseSchema>;
