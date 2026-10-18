// @vitest-environment node
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { estimateFontSizeFromOcr } from "./measure";
import { cleanLine, findTextLines, mergePasses, stopOcr, type OcrLine, type TextLine } from "./ocr";

const word = (text: string, x0: number, x1: number, confidence = 95, y0 = 100, y1 = 124) => ({
  text,
  confidence,
  bbox: { x0, y0, x1, y1 },
});
const ocrLine = (words: OcrLine["words"], confidence = 95, rowHeight = 28): OcrLine => ({
  confidence,
  rowAttributes: { rowHeight },
  words,
});

describe("cleanLine", () => {
  it("keeps text, confidence, row height and the box of the words", () => {
    expect(cleanLine(ocrLine([word("Email", 227, 299), word("address", 310, 420)]))).toEqual([
      {
        text: "Email address",
        confidence: 95,
        box: { x: 227, y: 100, w: 193, h: 24 },
        rowHeight: 28,
      },
    ]);
  });

  it("drops input borders read as characters, so the box stays on the text", () => {
    const [line] = cleanLine(
      ocrLine([
        word("|", 194, 197, 60, 60, 150),
        word("Email", 227, 299),
        word("address", 310, 420),
      ]),
    );
    expect(line).toMatchObject({ text: "Email address", box: { x: 227, y: 100, h: 24 } });
  });

  it("splits a line at a wide gap (two columns read as one line)", () => {
    const lines = cleanLine(
      ocrLine([word("Delivery", 1659, 1771), word("€4.50", 2242, 2327, 70)], 93),
    );
    expect(lines.map((l) => [l.text, l.box.x, l.confidence])).toEqual([
      ["Delivery", 1659, 95],
      ["€4.50", 2242, 70],
    ]);
  });

  it("keeps lines with confidence at least 60 and at least 2 characters (docs/04)", () => {
    expect(cleanLine(ocrLine([word("Total", 10, 80)], 59))).toEqual([]);
    expect(cleanLine(ocrLine([word("Total", 10, 80)], 60))).toHaveLength(1);
    expect(cleanLine(ocrLine([word("x", 10, 20)], 96))).toEqual([]);
    // A split piece is judged on its own words.
    expect(cleanLine(ocrLine([word("Total", 10, 80), word("€9", 900, 940, 40)], 90))).toEqual([
      expect.objectContaining({ text: "Total" }),
    ]);
  });
});

describe("mergePasses", () => {
  const line = (text: string, confidence: number, box: TextLine["box"]): TextLine => ({
    text,
    confidence,
    box,
    rowHeight: 28,
  });

  it("keeps one line per place, the more confident one, in reading order", () => {
    const merged = mergePasses([
      [line("WAYPOINT FREIGHT FREIGHT", 85, { x: 69, y: 19, w: 600, h: 95 })],
      [
        line("Fleet overview", 96, { x: 82, y: 165, w: 177, h: 24 }),
        line("WAYPOINT FREIGHT", 96, { x: 81, y: 40, w: 381, h: 32 }),
      ],
      [line("Fleet overvlew", 80, { x: 82, y: 166, w: 177, h: 23 })],
    ]);
    expect(merged.map((l) => l.text)).toEqual(["WAYPOINT FREIGHT", "Fleet overview"]);
  });

  it("keeps lines that only touch", () => {
    const merged = mergePasses([
      [line("Card", 96, { x: 0, y: 0, w: 100, h: 30 })],
      [line("PayPal", 96, { x: 90, y: 0, w: 100, h: 30 })],
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("findTextLines (tesseract.js on a demo screenshot)", () => {
  beforeAll(() => {
    vi.stubEnv("UXC_DATA_DIR", mkdtempSync(join(tmpdir(), "uxc-ocr-")));
  });
  afterAll(async () => {
    await stopOcr();
    vi.unstubAllEnvs();
  });

  it("finds the faint helper text and estimates its size", async () => {
    const lines = await findTextLines(readFileSync("public/demo/checkout-v1.png"));
    const helper = lines.find((l) => l.text === "We send your receipt to this address");
    expect(helper).toBeDefined();
    // The capture box of this line is x 194, y 497, 524 × 39 (Chromium's line box).
    expect(helper!.box.x).toBeGreaterThanOrEqual(190);
    expect(helper!.box.y).toBeGreaterThanOrEqual(497);
    expect(helper!.box.y + helper!.box.h).toBeLessThanOrEqual(536);
    // The CSS says 16 px; the OCR estimate is within 1 px.
    const size = estimateFontSizeFromOcr(helper!.rowHeight, helper!.box.h, 2);
    expect(Math.abs(Math.round(size) - 16)).toBeLessThanOrEqual(1);
    expect(lines.map((l) => l.text)).toEqual(
      expect.arrayContaining(["Checkout", "Payment", "Pay €50.50", "Terms"]),
    );
  }, 60_000);
});
