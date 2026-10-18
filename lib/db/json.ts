/** JSON columns are text; every read goes through zod (docs/02). */
import { z } from "zod";
import type { Box } from "../data/types.ts";

export const boxSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  w: z.number().positive(),
  h: z.number().positive(),
});

export const sourceSettingsSchema = z.object({
  nielsen: z.boolean(),
  wcag: z.boolean(),
  laws: z.boolean(),
  mine: z.boolean(),
});

export const reviewSourcesSchema = z.object({
  sets: sourceSettingsSchema,
  ruleIds: z.array(z.string()),
  /** False when the review ran without Claude ("Continue with measured checks only"). */
  evaluation: z.boolean().default(true),
});
export type ReviewSources = z.infer<typeof reviewSourcesSchema>;

export const reviewErrorSchema = z.object({
  message: z.string(),
  detail: z.string().nullable(),
});
export type ReviewError = z.infer<typeof reviewErrorSchema>;

export function readJson<T>(schema: z.ZodType<T>, text: string): T {
  return schema.parse(JSON.parse(text));
}

export function readBox(text: string | null): Box | null {
  return text === null ? null : readJson(boxSchema, text);
}

/** A stored error that is not JSON (written by hand, or an older row) still shows its text. */
export function readError(text: string | null): ReviewError | null {
  if (text === null) return null;
  try {
    return readJson(reviewErrorSchema, text);
  } catch {
    return { message: text, detail: null };
  }
}
