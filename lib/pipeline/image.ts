import sharp from "sharp";
import type { RawImage } from "./raw-image.ts";

/** Load any image file or buffer as raw RGB pixels (alpha flattened onto white). */
export async function loadRaw(input: string | Buffer): Promise<RawImage> {
  const { data, info } = await sharp(input)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height, channels: 3 };
}

/** docs/03: the long edge sent to Claude. Well under the 8000 px limit on any side. */
export const MAX_SENT_EDGE = 2576;
export const MAX_PNG_BASE64_BYTES = 9 * 1024 * 1024;

/** Size of the image sent to Claude and the factor back to original pixels (f = original / sent). */
export function sentSize(
  width: number,
  height: number,
): {
  width: number;
  height: number;
  factor: number;
} {
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_SENT_EDGE) return { width, height, factor: 1 };
  const scale = MAX_SENT_EDGE / longEdge;
  const sent = {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
  return { ...sent, factor: longEdge / Math.max(sent.width, sent.height) };
}

/** Maps a box from the sent image to original pixels (multiply by f). */
export function toOriginal(
  box: { x: number; y: number; w: number; h: number },
  factor: number,
): { x: number; y: number; w: number; h: number } {
  return { x: box.x * factor, y: box.y * factor, w: box.w * factor, h: box.h * factor };
}

/**
 * Any upload (PNG, JPEG or WebP) as the PNG kept in data/screenshots. Turns photos the right way
 * up and refuses files sharp cannot read.
 */
export async function toStoredPng(input: Buffer): Promise<{
  png: Buffer;
  width: number;
  height: number;
  format: string;
}> {
  const meta = await sharp(input).metadata();
  if (!meta.format || !["png", "jpeg", "webp"].includes(meta.format)) {
    throw new Error(`Unsupported image format: ${meta.format ?? "unknown"}`);
  }
  const { data, info } = await sharp(input).rotate().png().toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height, format: meta.format };
}

export type ClaudeImage = {
  mediaType: "image/png" | "image/jpeg";
  base64: string;
  width: number;
  height: number;
  /** original / sent: every box from Claude is multiplied by this. */
  factor: number;
};

/** The image for Claude: long edge at most 2576 px, JPEG quality 90 when PNG would be over 9 MB. */
export async function imageForClaude(input: string | Buffer): Promise<ClaudeImage> {
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) throw new Error("The screenshot has no size.");
  const size = sentSize(meta.width, meta.height);
  const resized = () =>
    sharp(input).resize(size.width, size.height, { fit: "fill", kernel: "lanczos3" });
  const png = await resized().png().toBuffer();
  const pngBase64 = png.toString("base64");
  if (pngBase64.length <= MAX_PNG_BASE64_BYTES) {
    return { mediaType: "image/png", base64: pngBase64, ...size };
  }
  const jpeg = await resized().flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  return { mediaType: "image/jpeg", base64: jpeg.toString("base64"), ...size };
}
