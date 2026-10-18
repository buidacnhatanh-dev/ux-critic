/**
 * pnpm demo:capture
 *
 * Renders the demo fixtures with Playwright at 1280 × 800, scale 2, into public/demo/<name>.png,
 * and writes demo/captures/<name>.json with where things are on the screenshot:
 *
 * - textLines: one box per rendered line of text (stands in for OCR line boxes)
 * - controls: one box per interactive element (stands in for Claude call 1)
 * - expected: the planted issues from eval/fixtures/<name>.expected.json with their boxes
 *
 * This only locates things. Every value (contrast, sizes) is computed from the PNG pixels later by
 * lib/pipeline/measure.ts in scripts/demo-data.ts. The CSS colour and font size recorded here are
 * for the sanity report only and never reach the demo data.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { captureFixture, root, SCALE, VIEWPORT } from "./capture.ts";

export const DEMO_FIXTURES = ["checkout-v1", "checkout-v2", "checkout-v3", "signup", "dashboard"];

/** Captures every demo fixture. Also used by pnpm demo:build. */
export async function captureDemo(): Promise<void> {
  await mkdir(path.join(root, "public/demo"), { recursive: true });
  await mkdir(path.join(root, "demo/captures"), { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  try {
    for (const name of DEMO_FIXTURES) {
      const { capture } = await captureFixture(
        context,
        name,
        path.join(root, "public/demo", `${name}.png`),
      );
      await writeFile(
        path.join(root, "demo/captures", `${name}.json`),
        `${JSON.stringify(capture, null, 2)}\n`,
      );
      console.log(
        `${name}: ${capture.textLines.length} text lines, ${capture.controls.length} controls → public/demo/${name}.png`,
      );
    }
  } finally {
    await browser.close();
  }
}

if (import.meta.main) await captureDemo();
