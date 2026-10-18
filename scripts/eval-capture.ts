/**
 * pnpm eval:capture (docs/08)
 *
 * Renders every eval/fixtures/*.html with Playwright at 1280 × 800, scale 2, into
 * eval/cases/<name>.png, and writes eval/cases/<name>.json: the expected issues from
 * <name>.expected.json with their selectors turned into boxes (image px, around what each element
 * shows, so a short line in a wide paragraph gets the box of the line), plus every control on
 * the page for pnpm eval:measured. Cases the owner added by hand are left alone.
 */
import { chromium } from "@playwright/test";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { evalCaseSchema } from "../lib/eval/case.ts";
import { captureFixture, root, SCALE, VIEWPORT } from "./capture.ts";

const fixtures = (await readdir(path.join(root, "eval/fixtures")))
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.slice(0, -".html".length))
  .sort();

await mkdir(path.join(root, "eval/cases"), { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
try {
  for (const name of fixtures) {
    const { capture, expected } = await captureFixture(
      context,
      name,
      path.join(root, "eval/cases", `${name}.png`),
      { tightExpected: true },
    );
    const evalCase = evalCaseSchema.parse({
      name,
      description: expected.description,
      context: "",
      source: "fixture",
      width: capture.width,
      height: capture.height,
      scale: capture.scale,
      issues: expected.issues.map((issue, i) => ({
        id: issue.id,
        kind: issue.kind,
        principle_id: issue.principle_id,
        note: issue.note,
        box: capture.expected[i]!.box,
      })),
      controls: capture.controls.map((c) => ({ label: c.label, box: c.box })),
    });
    await writeFile(
      path.join(root, "eval/cases", `${name}.json`),
      `${JSON.stringify(evalCase, null, 2)}\n`,
    );
    console.log(
      `${name}: ${evalCase.issues.length} planted problems, ${capture.controls.length} controls → eval/cases/${name}.png`,
    );
  }
} finally {
  await browser.close();
}
console.log(`\n${fixtures.length} cases in eval/cases/`);
