/**
 * Claude call 1 (docs/03 "Claude call 1: locate controls"): Claude only says where the controls
 * are; code measures their size (docs/04). Prompt and parsing are pure.
 */
import { z } from "zod";
import type { ClaudeImage } from "./image.ts";
import { clampToImage, type SentBox } from "./evaluate.ts";

/** The answer is a list of boxes; this leaves plenty of room for adaptive thinking too. */
export const LOCATE_MAX_TOKENS = 16_000;
/** Boxes thinner than this are not controls (docs/03). */
export const MIN_CONTROL_PX = 4;

export const CONTROL_ROLES = [
  "button",
  "link",
  "input",
  "select",
  "checkbox",
  "radio",
  "toggle",
  "tab",
  "icon_button",
  "other",
] as const;

export const LOCATE_SYSTEM_PROMPT = [
  "You find interactive controls in a screenshot of a user interface.",
  "Return every button, link, text input, select, checkbox, radio, toggle, tab and icon button you can see.",
  "For each, give a short label (its visible text, or what the icon means) and a tight bounding box in pixels of this image: x, y of the top left corner, width, height.",
  "The box covers the visible control, including its border or background, not the surrounding whitespace.",
  "Links inside running text count. Decorative images do not.",
  "Return only what you can see. Do not guess hidden elements.",
].join("\n");

export const LOCATE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    controls: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", enum: [...CONTROL_ROLES] },
          label: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
          width: { type: "integer" },
          height: { type: "integer" },
        },
        required: ["role", "label", "x", "y", "width", "height"],
        additionalProperties: false,
      },
    },
  },
  required: ["controls"],
  additionalProperties: false,
};

/** The image alone; the system prompt says what to do with it. */
export function locateContent(image: ClaudeImage) {
  return [
    {
      type: "image" as const,
      source: { type: "base64" as const, media_type: image.mediaType, data: image.base64 },
    },
    { type: "text" as const, text: "Find the interactive controls in this screenshot." },
  ];
}

export type LocatedControlSent = {
  role: (typeof CONTROL_ROLES)[number];
  label: string;
  /** In pixels of the image Claude received. */
  box: SentBox;
};

/** Call 1's answer could not be read: target sizes are skipped, nothing else changes. */
export class LocateUnreadableError extends Error {
  // A plain field, not a parameter property: Node's type stripping (scripts) can't run those.
  readonly raw: string;
  constructor(reason: string, raw: string) {
    super(reason);
    this.raw = raw;
    this.name = "LocateUnreadableError";
  }
}

const whole = z.number().int().min(0);
const itemSchema = z.object({
  role: z.enum(CONTROL_ROLES),
  label: z.string().trim().min(1).max(200),
  x: whole,
  y: whole,
  width: whole.min(MIN_CONTROL_PX),
  height: whole.min(MIN_CONTROL_PX),
});
const answerSchema = z.object({ controls: z.array(z.unknown()) });

/**
 * Reads call 1's answer (docs/03): integers at least 0, width and height at least 4, boxes inside
 * the image. Invalid items are dropped, not the whole answer. Throws LocateUnreadableError when the
 * text is not the expected JSON.
 */
export function parseControls(
  raw: string,
  size: { width: number; height: number },
): { controls: LocatedControlSent[]; dropped: number } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new LocateUnreadableError("The answer is not JSON.", raw);
  }
  const answer = answerSchema.safeParse(json);
  if (!answer.success) throw new LocateUnreadableError("The answer has no controls list.", raw);

  const controls: LocatedControlSent[] = [];
  for (const item of answer.data.controls) {
    const parsed = itemSchema.safeParse(item);
    if (!parsed.success) continue;
    const { x, y, width, height } = parsed.data;
    // Inside the image: a box that starts outside or reaches past the edge is dropped.
    if (x + width > size.width || y + height > size.height) continue;
    const box = clampToImage({ x, y, width, height }, size);
    if (!box) continue;
    controls.push({ role: parsed.data.role, label: parsed.data.label, box });
  }
  return { controls, dropped: answer.data.controls.length - controls.length };
}
