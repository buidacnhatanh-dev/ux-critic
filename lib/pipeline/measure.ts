/**
 * Measured checks from docs/04: contrast, text size and target size, computed from pixels.
 * Pure functions on raw RGB pixels. Locating text lines and controls happens elsewhere.
 */
import { contrastRatio, contrastThreshold, relativeLuminance, type Rgb } from "../contrast.ts";
import { clampBox, expandBox, pixelAt, type PixelBox, type RawImage } from "./raw-image.ts";

export const BACKGROUND_RING_PX = 2;
export const TEXT_SAMPLE_SHARE = 0.1;
export const LINE_HEIGHT_FACTOR = 1.2;
/** OCR row height (ascender to descender) as a share of the font size, measured in M6. */
export const OCR_ROW_HEIGHT_FACTOR = 0.87;
/** OCR row heights above this many glyph box heights are row statistics gone wrong. */
export const OCR_ROW_HEIGHT_CAP = 1.25;
export const TARGET_EXPAND_CSS_PX = 8;
export const TARGET_RGB_DISTANCE = 30;
export const WCAG_TARGET_MIN = 24;
export const DEFAULT_TARGET_RULE_MIN = 44;
export const DEFAULT_TEXT_SIZE_MIN = 16;
export const BODY_TEXT_MIN_CHARS = 20;

/** 5 bits per channel, as one number, for counting colours. */
function quantKey({ r, g, b }: Rgb): number {
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

/** Most common colour among the given pixels, after quantising. Returns the bucket's mean colour. */
export function dominantColour(pixels: Iterable<Rgb>): Rgb | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (const p of pixels) {
    const key = quantKey(p);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += p.r;
    bucket.g += p.g;
    bucket.b += p.b;
    buckets.set(key, bucket);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
  if (!best) return null;
  return {
    r: Math.round(best.r / best.n),
    g: Math.round(best.g / best.n),
    b: Math.round(best.b / best.n),
  };
}

/** Pixels in a ring of `ring` px just outside the box, inside the image. */
export function* ringPixels(img: RawImage, box: PixelBox, ring: number): Generator<Rgb> {
  const outer = clampBox(img, expandBox(box, ring));
  if (!outer) return;
  for (let y = outer.y; y < outer.y + outer.h; y++) {
    for (let x = outer.x; x < outer.x + outer.w; x++) {
      const inside = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
      if (!inside) yield pixelAt(img, x, y);
    }
  }
}

/** Pixels on the 1 px border of the box. */
export function* borderPixels(img: RawImage, box: PixelBox): Generator<Rgb> {
  const b = clampBox(img, box);
  if (!b) return;
  for (let x = b.x; x < b.x + b.w; x++) {
    yield pixelAt(img, x, b.y);
    if (b.h > 1) yield pixelAt(img, x, b.y + b.h - 1);
  }
  for (let y = b.y + 1; y < b.y + b.h - 1; y++) {
    yield pixelAt(img, b.x, y);
    if (b.w > 1) yield pixelAt(img, b.x + b.w - 1, y);
  }
}

/** Step 2: background is the most common colour in a 2 px ring just outside the text box. */
export function backgroundColour(img: RawImage, box: PixelBox): Rgb | null {
  return dominantColour(ringPixels(img, box, BACKGROUND_RING_PX));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Step 3: text colour is the median of the 10 % of pixels inside the box that are furthest from
 * the background in luminance. This skips anti aliased glyph edges.
 */
export function textColour(img: RawImage, box: PixelBox, background: Rgb): Rgb | null {
  const b = clampBox(img, box);
  if (!b) return null;
  const bgLum = relativeLuminance(background);
  const scored: { p: Rgb; d: number }[] = [];
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      const p = pixelAt(img, x, y);
      scored.push({ p, d: Math.abs(relativeLuminance(p) - bgLum) });
    }
  }
  scored.sort((a, c) => c.d - a.d);
  const top = scored.slice(0, Math.max(1, Math.round(scored.length * TEXT_SAMPLE_SHARE)));
  return {
    r: median(top.map((s) => s.p.r)),
    g: median(top.map((s) => s.p.g)),
    b: median(top.map((s) => s.p.b)),
  };
}

/** Estimated font size in CSS px from a text line box height in image pixels. */
export function estimateFontSize(lineBoxHeight: number, scale: number): number {
  return lineBoxHeight / scale / LINE_HEIGHT_FACTOR;
}

/**
 * Estimated font size in CSS px from an OCR text line (docs/04): OCR boxes are tight around the
 * glyphs, not a 1.2 line box, so this uses tesseract's row height, capped by the glyph box height.
 */
export function estimateFontSizeFromOcr(
  rowHeight: number,
  boxHeight: number,
  scale: number,
): number {
  return Math.min(rowHeight, boxHeight * OCR_ROW_HEIGHT_CAP) / scale / OCR_ROW_HEIGHT_FACTOR;
}

export type ContrastResult = {
  ratio: number;
  threshold: number;
  passes: boolean;
  text: Rgb;
  background: Rgb;
  fontSize: number;
};

/**
 * Steps 1 to 5 for one text line. The font size (for the large text threshold) is estimated from
 * the box as a 1.2 line box unless an estimate is given (OCR lines).
 */
export function measureContrast(
  img: RawImage,
  box: PixelBox,
  scale: number,
  ruleMin?: number | null,
  fontSizeEstimate?: number,
): ContrastResult | null {
  const background = backgroundColour(img, box);
  if (!background) return null;
  const text = textColour(img, box, background);
  if (!text) return null;
  const fontSize = fontSizeEstimate ?? estimateFontSize(box.h, scale);
  const ratio = contrastRatio(text, background);
  const threshold = contrastThreshold(fontSize, ruleMin);
  return { ratio, threshold, passes: ratio >= threshold, text, background, fontSize };
}

export type TextSizeResult = { size: number; threshold: number; passes: boolean };

/**
 * Text size: fails below the rule (default 16 px) for lines longer than 20 characters, so labels
 * and captions are not flagged as body text. The estimate is rounded, as it is shown ("about 13 px").
 */
export function measureTextSize(
  lineBoxHeight: number,
  scale: number,
  text: string,
  ruleMin: number = DEFAULT_TEXT_SIZE_MIN,
): TextSizeResult {
  return checkTextSize(estimateFontSize(lineBoxHeight, scale), text, ruleMin);
}

/** The same check for a size that is already estimated in CSS px (OCR lines). */
export function checkTextSize(
  estimate: number,
  text: string,
  ruleMin: number = DEFAULT_TEXT_SIZE_MIN,
): TextSizeResult {
  const size = Math.round(estimate);
  const isBody = text.trim().length > BODY_TEXT_MIN_CHARS;
  return { size, threshold: ruleMin, passes: !isBody || size >= ruleMin };
}

/**
 * Target size steps 1 to 3: expand the control box by 8 CSS px, take the most common colour on
 * its border as background, and return the bounds of the pixels that differ from it.
 */
export function tightBox(img: RawImage, box: PixelBox, scale: number): PixelBox | null {
  const expanded = clampBox(img, expandBox(box, TARGET_EXPAND_CSS_PX * scale));
  if (!expanded) return null;
  const background = dominantColour(borderPixels(img, expanded));
  if (!background) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = expanded.y; y < expanded.y + expanded.h; y++) {
    for (let x = expanded.x; x < expanded.x + expanded.w; x++) {
      const p = pixelAt(img, x, y);
      const distance = Math.hypot(p.r - background.r, p.g - background.g, p.b - background.b);
      if (distance > TARGET_RGB_DISTANCE) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export type TargetSizeResult = {
  tight: PixelBox;
  width: number;
  height: number;
  /** The smaller dimension, which is what gets reported. */
  smaller: { size: number; dimension: "tall" | "wide" };
  passesWcag: boolean;
  passesRule: boolean;
  ruleMin: number;
};

/** Steps 4 and 5: size in CSS px, checked against WCAG 2.5.8 (24) and the rule (default 44). */
export function measureTargetSize(
  img: RawImage,
  box: PixelBox,
  scale: number,
  ruleMin: number = DEFAULT_TARGET_RULE_MIN,
): TargetSizeResult | null {
  const tight = tightBox(img, box, scale);
  if (!tight) return null;
  const width = tight.w / scale;
  const height = tight.h / scale;
  const smaller =
    height <= width
      ? { size: height, dimension: "tall" as const }
      : { size: width, dimension: "wide" as const };
  return {
    tight,
    width,
    height,
    smaller,
    passesWcag: width >= WCAG_TARGET_MIN && height >= WCAG_TARGET_MIN,
    passesRule: width >= ruleMin && height >= ruleMin,
    ruleMin,
  };
}
