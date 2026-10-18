// @vitest-environment node
import sharp from "sharp";
import { contrastRatio, parseHex, roundRatio, toHex } from "../contrast";
import { loadRaw } from "./image";
import {
  backgroundColour,
  dominantColour,
  checkTextSize,
  estimateFontSize,
  estimateFontSizeFromOcr,
  measureContrast,
  measureTargetSize,
  measureTextSize,
  textColour,
  tightBox,
} from "./measure";
import { solidImage } from "./raw-image";

const WHITE = parseHex("#FFFFFF");
const FAINT = parseHex("#B9BFC8");
const INK = parseHex("#15181D");
const BLUE = parseHex("#1D4ED8");

/** Renders anti aliased text with sharp (librsvg), like a real screenshot. */
async function textImage(opts: { fg: string; bg: string; size: number; text: string }) {
  const width = 400;
  const height = 80;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${opts.bg}"/>
    <text x="20" y="50" font-family="Arial, Helvetica, sans-serif" font-size="${opts.size}" fill="${opts.fg}">${opts.text}</text>
  </svg>`;
  return loadRaw(await sharp(Buffer.from(svg)).png().toBuffer());
}

/** Text line box like OCR would give: the bounds of the ink, padded by 2 px. */
function lineBox(img: Awaited<ReturnType<typeof textImage>>) {
  const ink = tightBox(img, { x: 8, y: 8, w: img.width - 16, h: img.height - 16 }, 1)!;
  return { x: ink.x - 2, y: ink.y - 2, w: ink.w + 4, h: ink.h + 4 };
}

describe("dominantColour", () => {
  it("picks the most common colour", () => {
    const pixels = [WHITE, WHITE, WHITE, INK, INK];
    expect(toHex(dominantColour(pixels)!)).toBe("#FFFFFF");
  });

  it("groups near colours (5 bits per channel)", () => {
    const pixels = [{ r: 250, g: 250, b: 250 }, { r: 252, g: 251, b: 249 }, INK];
    expect(dominantColour(pixels)).toEqual({ r: 251, g: 251, b: 250 });
  });

  it("is null for no pixels", () => {
    expect(dominantColour([])).toBeNull();
  });
});

describe("backgroundColour", () => {
  it("reads the ring just outside the box, not the inside", () => {
    const img = solidImage(40, 40, WHITE, [{ box: { x: 10, y: 10, w: 20, h: 20 }, colour: INK }]);
    expect(backgroundColour(img, { x: 10, y: 10, w: 20, h: 20 })).toEqual(WHITE);
  });

  it("finds a coloured surface around text (text on a button)", () => {
    const img = solidImage(60, 40, WHITE, [
      { box: { x: 5, y: 5, w: 50, h: 30 }, colour: BLUE },
      { box: { x: 15, y: 15, w: 30, h: 10 }, colour: WHITE },
    ]);
    expect(backgroundColour(img, { x: 15, y: 15, w: 30, h: 10 })).toEqual(BLUE);
  });
});

describe("textColour", () => {
  it("takes the colour furthest from the background", () => {
    // 20 % of the box is text, the rest background.
    const img = solidImage(10, 10, WHITE, [{ box: { x: 0, y: 0, w: 2, h: 10 }, colour: FAINT }]);
    expect(textColour(img, { x: 0, y: 0, w: 10, h: 10 }, WHITE)).toEqual(FAINT);
  });

  it("ignores anti aliased edges on rendered text", async () => {
    const img = await textImage({ fg: "#B9BFC8", bg: "#FFFFFF", size: 32, text: "Card number" });
    const text = textColour(img, { x: 15, y: 15, w: 220, h: 50 }, WHITE)!;
    expect(roundRatio(contrastRatio(text, WHITE))).toBeCloseTo(1.85, 1);
  });
});

describe("measureContrast", () => {
  it("measures faint text on white and fails it", async () => {
    const img = await textImage({ fg: "#B9BFC8", bg: "#FFFFFF", size: 32, text: "Faint helper" });
    const result = measureContrast(img, lineBox(img), 2)!;
    expect(toHex(result.background)).toBe("#FFFFFF");
    expect(result.ratio).toBeLessThan(2);
    expect(result.threshold).toBe(4.5);
    expect(result.passes).toBe(false);
  });

  it("passes dark text", async () => {
    const img = await textImage({ fg: "#15181D", bg: "#FFFFFF", size: 32, text: "Pay now" });
    const result = measureContrast(img, lineBox(img), 2)!;
    expect(roundRatio(result.ratio)).toBeCloseTo(17.79, 0);
    expect(result.passes).toBe(true);
  });

  it("measures light text on a dark surface", async () => {
    const img = await textImage({ fg: "#FFFFFF", bg: "#1D4ED8", size: 32, text: "Continue" });
    const result = measureContrast(img, lineBox(img), 2)!;
    expect(toHex(result.background)).toBe("#1D4ED8");
    expect(roundRatio(result.ratio)).toBeCloseTo(roundRatio(contrastRatio(WHITE, BLUE)), 0);
  });

  it("uses 3 : 1 for large text (box at least 24 CSS px tall after the line factor)", () => {
    const img = solidImage(200, 100, WHITE, [{ box: { x: 0, y: 0, w: 30, h: 60 }, colour: INK }]);
    // 58 image px / scale 1 / 1.2 = about 48 px font.
    expect(measureContrast(img, { x: 0, y: 0, w: 150, h: 58 }, 1)!.threshold).toBe(3);
  });

  it("applies a stricter rule threshold", () => {
    const img = solidImage(100, 40, WHITE, [{ box: { x: 10, y: 10, w: 20, h: 20 }, colour: INK }]);
    expect(measureContrast(img, { x: 5, y: 5, w: 80, h: 30 }, 2, 7)!.threshold).toBe(7);
  });
});

describe("text size", () => {
  it("estimates font size from the line box height and scale", () => {
    expect(estimateFontSize(38.4, 2)).toBeCloseTo(16, 10);
    expect(estimateFontSize(15.6, 1)).toBeCloseTo(13, 10);
  });

  it("fails small body text longer than 20 characters", () => {
    expect(measureTextSize(31.2, 2, "Totals update every night at midnight")).toEqual({
      size: 13,
      threshold: 16,
      passes: false,
    });
  });

  it("does not flag short labels and captions", () => {
    expect(measureTextSize(31.2, 2, "Last 30 days").passes).toBe(true);
  });

  it("passes body text at the threshold and respects a rule", () => {
    expect(measureTextSize(38.4, 2, "A sentence long enough to be body text").passes).toBe(true);
    expect(measureTextSize(38.4, 2, "A sentence long enough to be body text", 18).passes).toBe(
      false,
    );
  });
});

describe("text size from OCR lines", () => {
  it("uses the row height over 0.87, capped at 1.25 glyph box heights", () => {
    // 16 px text at scale 2 (measured on the demo fixtures): row height 28, box 23 to 30.
    expect(estimateFontSizeFromOcr(27.84, 30, 2)).toBeCloseTo(16, 10);
    // A row height far above the glyph box (OCR row statistics gone wrong) is capped.
    expect(estimateFontSizeFromOcr(46.8, 24, 2)).toBeCloseTo(30 / 2 / 0.87, 10);
  });

  it("checks an estimate like a line box", () => {
    expect(checkTextSize(13.2, "Times are local to each depot")).toEqual({
      size: 13,
      threshold: 16,
      passes: false,
    });
    expect(checkTextSize(13.2, "Last 30 days").passes).toBe(true);
    expect(checkTextSize(15.6, "We send your receipt to this address").passes).toBe(true);
  });

  it("uses the estimate for the large text threshold of contrast", async () => {
    // Grey on white at about 3.5 : 1: fails as body text, passes as large text (24 px and up).
    const img = await loadRaw(
      await sharp({ create: { width: 60, height: 40, channels: 3, background: "#ffffff" } })
        .composite([
          {
            input: await sharp({
              create: { width: 20, height: 10, channels: 3, background: "#8a8a8a" },
            })
              .png()
              .toBuffer(),
            left: 20,
            top: 15,
          },
        ])
        .png()
        .toBuffer(),
    );
    const box = { x: 20, y: 15, w: 20, h: 10 };
    expect(measureContrast(img, box, 1, null, 14)!.threshold).toBe(4.5);
    expect(measureContrast(img, box, 1, null, 26)!.threshold).toBe(3);
  });
});

describe("target size", () => {
  it("finds the tight box of a button inside a loose control box", () => {
    const img = solidImage(200, 120, WHITE, [
      { box: { x: 50, y: 40, w: 96, h: 48 }, colour: BLUE },
    ]);
    expect(tightBox(img, { x: 45, y: 35, w: 110, h: 60 }, 2)).toEqual({
      x: 50,
      y: 40,
      w: 96,
      h: 48,
    });
  });

  it("uses the text bounds for a link without a background", () => {
    const img = solidImage(200, 100, WHITE, [
      { box: { x: 60, y: 40, w: 50, h: 22 }, colour: BLUE },
    ]);
    const result = measureTargetSize(img, { x: 56, y: 36, w: 60, h: 30 }, 2)!;
    expect(result.height).toBe(11);
    expect(result.width).toBe(25);
    expect(result.smaller).toEqual({ size: 11, dimension: "tall" });
    expect(result.passesWcag).toBe(false);
    expect(result.passesRule).toBe(false);
  });

  it("passes WCAG but fails the 44 px rule between 24 and 44", () => {
    const img = solidImage(300, 200, WHITE, [
      { box: { x: 50, y: 50, w: 160, h: 64 }, colour: BLUE },
    ]);
    const result = measureTargetSize(img, { x: 50, y: 50, w: 160, h: 64 }, 2)!;
    expect(result.height).toBe(32);
    expect(result.passesWcag).toBe(true);
    expect(result.passesRule).toBe(false);
  });

  it("passes a 48 px tall button and reports the smaller dimension as wide", () => {
    const img = solidImage(300, 300, WHITE, [
      { box: { x: 50, y: 50, w: 96, h: 200 }, colour: BLUE },
    ]);
    const result = measureTargetSize(img, { x: 50, y: 50, w: 96, h: 200 }, 2)!;
    expect(result.smaller).toEqual({ size: 48, dimension: "wide" });
    expect(result.passesWcag && result.passesRule).toBe(true);
  });

  it("is null when nothing differs from the background", () => {
    const img = solidImage(100, 100, WHITE);
    expect(measureTargetSize(img, { x: 20, y: 20, w: 40, h: 40 }, 2)).toBeNull();
  });
});
