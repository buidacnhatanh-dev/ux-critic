/**
 * WCAG 2.2 contrast maths and the passing colour suggestion (docs/04).
 * Pure functions, no dependencies, so the demo scripts can run them with plain Node.
 */

export type Rgb = { r: number; g: number; b: number };

export function parseHex(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

/** sRGB channel (0…255) to linear light (0…1). */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(linear: number): number {
  const c = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return c * 255;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio, 1 to 21. Order of the colours does not matter. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Rounded to 2 decimals for display. */
export function roundRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

/** "1.85 : 1" */
export function formatRatio(ratio: number): string {
  return `${roundRatio(ratio).toFixed(2)} : 1`;
}

/** Threshold for text: 4.5, or 3.0 for large text (at least 24 CSS px). A stricter rule wins. */
export function contrastThreshold(fontSizeCssPx: number, ruleMin?: number | null): number {
  const base = fontSizeCssPx >= 24 ? 3 : 4.5;
  return ruleMin && ruleMin > base ? ruleMin : base;
}

// OKLCH (Björn Ottosson's OKLab), used to keep hue and chroma while changing lightness.

export type Oklch = { l: number; c: number; h: number };

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const clamp = (v: number) => Math.min(255, Math.max(0, fromLinear(v)));
  return {
    r: clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  };
}

export type ColourSuggestion = { hex: string; ratio: number };

/**
 * Nearest passing colour along the same hue: lower (light background) or raise (dark background)
 * OKLCH lightness in 1 % steps, keeping hue and chroma, until the ratio passes.
 * Returns null when no lightness passes (for example a mid grey background and 7 : 1).
 */
export function suggestPassingColour(
  text: Rgb,
  background: Rgb,
  threshold: number,
): ColourSuggestion | null {
  const start = rgbToOklch(text);
  const darker = relativeLuminance(background) >= 0.18;
  for (let step = 0; step <= 100; step++) {
    const l = darker ? start.l - step / 100 : start.l + step / 100;
    if (l < 0 || l > 1) break;
    // Round to a real hex colour first, so the ratio we report is the one people will get.
    const candidate = parseHex(toHex(oklchToRgb({ ...start, l })));
    const ratio = contrastRatio(candidate, background);
    if (ratio >= threshold) return { hex: toHex(candidate), ratio };
  }
  const extreme = darker ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const ratio = contrastRatio(extreme, background);
  return ratio >= threshold ? { hex: toHex(extreme), ratio } : null;
}
