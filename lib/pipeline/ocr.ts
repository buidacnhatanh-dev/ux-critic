/**
 * Text lines on a screenshot (docs/04 "Text lines"): tesseract.js, English and German, line level,
 * on the original image. The language data comes from the @tesseract.js-data packages in
 * node_modules, so OCR never makes a network request.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { dataDir } from "../db/client.ts";
import type { PixelBox } from "./raw-image.ts";

export const OCR_MIN_CONFIDENCE = 60;
export const OCR_MIN_CHARS = 2;
const LANGS = ["eng", "deu"] as const;
/** A gap wider than this many row heights splits a line (two columns read as one line). */
const SPLIT_GAP_ROWS = 1.5;
/** Two lines from different passes are the same when this share of the smaller one overlaps. */
const SAME_LINE_OVERLAP = 0.6;

export type TextLine = {
  text: string;
  confidence: number;
  /** Union of the word boxes, in original image pixels. */
  box: PixelBox;
  /** Tesseract's row height (x height + ascenders + descenders), for the text size estimate. */
  rowHeight: number;
};

type Bbox = { x0: number; y0: number; x1: number; y1: number };

/** The part of a tesseract line that is used here. */
export type OcrLine = {
  confidence: number;
  rowAttributes: { rowHeight: number };
  words: { text: string; confidence: number; bbox: Bbox }[];
};

/** Input borders and checkboxes read as "|", "[" or "_". Words made only of these are dropped. */
const NOISE = /^[\s|[\](){}_\-—–=~.,:;'"`‘’“”*°•·]*$/;

function toBox(words: { bbox: Bbox }[]): PixelBox {
  const x0 = Math.min(...words.map((w) => w.bbox.x0));
  const y0 = Math.min(...words.map((w) => w.bbox.y0));
  const x1 = Math.max(...words.map((w) => w.bbox.x1));
  const y1 = Math.max(...words.map((w) => w.bbox.y1));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * One tesseract line as clean text lines: noise words dropped, the box made from the remaining
 * words, split where a wide gap shows two separate pieces of text. Then the docs/04 filter: keep
 * lines with confidence at least 60 and at least 2 characters. Pure.
 */
export function cleanLine(line: OcrLine): TextLine[] {
  const rowHeight = line.rowAttributes.rowHeight;
  const words = line.words.filter(
    (w) => !NOISE.test(w.text) && w.bbox.x1 > w.bbox.x0 && w.bbox.y1 > w.bbox.y0,
  );
  const groups: (typeof words)[] = [];
  for (const word of [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0)) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (group && previous && word.bbox.x0 - previous.bbox.x1 <= SPLIT_GAP_ROWS * rowHeight) {
      group.push(word);
    } else {
      groups.push([word]);
    }
  }
  const kept: TextLine[] = [];
  for (const group of groups) {
    const text = group
      .map((w) => w.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    // A split piece is judged on its own words; a whole line keeps tesseract's line confidence.
    const confidence =
      groups.length === 1
        ? line.confidence
        : group.reduce((sum, w) => sum + w.confidence, 0) / group.length;
    if (confidence < OCR_MIN_CONFIDENCE || text.length < OCR_MIN_CHARS) continue;
    kept.push({ text, confidence, box: toBox(group), rowHeight });
  }
  return kept;
}

/** Share of the smaller box that the two boxes have in common. */
function overlapOfSmaller(a: PixelBox, b: PixelBox): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

/**
 * Lines from several passes: where two overlap (the same text, or one misread line that spans
 * a better one), the more confident one stays. Pure.
 */
export function mergePasses(passes: TextLine[][]): TextLine[] {
  const merged: TextLine[] = [];
  for (const line of passes.flat().sort((a, b) => b.confidence - a.confidence)) {
    if (!merged.some((m) => overlapOfSmaller(m.box, line.box) >= SAME_LINE_OVERLAP))
      merged.push(line);
  }
  return merged.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
}

/**
 * tesseract.js reads every language from one folder, but each data package has its own. So the
 * LSTM data (best_int) is copied once into data/tessdata. (Passing the data in memory does not
 * work in tesseract.js 7: it initialises with the data instead of the language code.)
 */
async function langFolder(): Promise<string> {
  const folder = path.join(dataDir(), "tessdata");
  await mkdir(folder, { recursive: true });
  for (const code of LANGS) {
    // From the project's node_modules at runtime; live mode runs from the project folder, and a
    // bundler must not rewrite this path.
    const from = path.resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      "node_modules/@tesseract.js-data",
      code,
      "4.0.0_best_int",
      `${code}.traineddata.gz`,
    );
    const to = path.join(folder, `${code}.traineddata.gz`);
    const [a, b] = await Promise.all([stat(from), stat(to).catch(() => null)]);
    if (!b || b.size !== a.size) await copyFile(from, to);
  }
  return folder;
}

type Tesseract = typeof import("tesseract.js");
type Worker = Awaited<ReturnType<Tesseract["createWorker"]>>;

/** One worker for the server process, made on first use. On globalThis so hot reloads keep it. */
const shared = globalThis as typeof globalThis & { __uxcOcr?: Promise<Worker> };

async function makeWorker(): Promise<Worker> {
  const tesseract = (await import("tesseract.js")).default as unknown as Tesseract;
  return tesseract.createWorker([...LANGS], tesseract.OEM.LSTM_ONLY, {
    langPath: await langFolder(),
    cacheMethod: "none",
    gzip: true,
  });
}

function getWorker(): Promise<Worker> {
  shared.__uxcOcr ??= makeWorker().catch((error: unknown) => {
    shared.__uxcOcr = undefined;
    throw error;
  });
  return shared.__uxcOcr;
}

/**
 * Three passes in sparse text mode (UI text is not running prose): tesseract's default global
 * threshold; a local threshold, which also finds faint text such as light grey helper text; and
 * the inverted image, for light text on dark buttons. Every pass reads an image of the original
 * size, so the boxes are in original pixels. Pixels are always measured on the original.
 */
const PASSES = [
  { invert: false, params: { tessedit_pageseg_mode: "11", thresholding_method: "0" } },
  { invert: false, params: { tessedit_pageseg_mode: "11", thresholding_method: "1" } },
  { invert: false, params: { tessedit_pageseg_mode: "3", thresholding_method: "0" } },
  { invert: false, params: { tessedit_pageseg_mode: "3", thresholding_method: "1" } },
] as const;

/** One OCR at a time: the passes change the worker's parameters. */
let queue: Promise<unknown> = Promise.resolve();

/** OCR text lines of a PNG (any image sharp can read), in original pixels. */
export function findTextLines(png: Buffer): Promise<TextLine[]> {
  const run = queue.then(() => recognizeAll(png));
  queue = run.catch(() => undefined);
  return run;
}

async function recognizeAll(png: Buffer): Promise<TextLine[]> {
  const worker = await getWorker();
  const inverted = await sharp(png).flatten({ background: "#ffffff" }).negate().png().toBuffer();
  const passes: TextLine[][] = [];
  for (const pass of PASSES) {
    await worker.setParameters(pass.params as unknown as Parameters<Worker["setParameters"]>[0]);
    const result = await worker.recognize(
      pass.invert ? inverted : png,
      {},
      {
        blocks: true,
        text: false,
      },
    );
    const lines: TextLine[] = [];
    for (const block of result.data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) lines.push(...cleanLine(line));
      }
    }
    passes.push(lines);
  }
  return mergePasses(passes);
}

/** Stops the worker (scripts and tests; the server keeps it). */
export async function stopOcr(): Promise<void> {
  const worker = shared.__uxcOcr;
  shared.__uxcOcr = undefined;
  if (worker) await (await worker).terminate();
}
