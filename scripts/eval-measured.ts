/**
 * pnpm eval:measured: scores only the measured checks (docs/04) on every case in eval/cases,
 * without any key and without calling Claude. Writes eval/runs/<date>-measured.md.
 *
 * - Contrast and text size run exactly as in a live review: tesseract.js finds the text lines on
 *   the PNG, then lib/pipeline/measure-screen.ts measures them from the pixels.
 * - Target size needs Claude call 1 to find the controls. Here the controls come from the page
 *   instead (located by pnpm eval:capture), then the same code measures them from the pixels.
 *   Cases without located controls (added by hand) skip target sizes.
 * - Rules: a first run checklist (contrast 4.5 : 1, targets 24 px WCAG and 44 px rule, body text
 *   16 px).
 *
 * The checks are deterministic, so one run per case.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatRatio } from "../lib/contrast.ts";
import { checkOf, CHECKS, seedMeasuredRules, tallyByCheck } from "../lib/eval/measured.ts";
import { recall, scoreRun, type ExpectedIssue, type RunScore } from "../lib/eval/score.ts";
import { loadRaw } from "../lib/pipeline/image.ts";
import { fromOcr, measureScreen } from "../lib/pipeline/measure-screen.ts";
import { findTextLines, stopOcr } from "../lib/pipeline/ocr.ts";
import { numberInReadingOrder } from "../lib/pipeline/order.ts";
import { expectedOf, freshStem, loadCases, parseArgs, root } from "./eval-cases.ts";

const CHECK_NAMES = { contrast: "Contrast", text_size: "Text size", target_size: "Target size" };

const args = parseArgs(process.argv.slice(2));
const cases = await loadCases(args.get("case") ?? []);
const rules = seedMeasuredRules();

type Row = {
  name: string;
  expected: ExpectedIssue[];
  score: RunScore;
  checks: number;
  textLines: number;
  controls: number | null;
  seconds: number;
  notes: string[];
};
const rows: Row[] = [];
try {
  for (const c of cases) {
    const started = performance.now();
    const png = await readFile(c.png);
    const img = await loadRaw(png);
    const lines = await findTextLines(png);
    const screen = measureScreen({
      img,
      scale: c.scale,
      textLines: fromOcr(lines, c.scale),
      controls: c.controls ?? [],
      rules,
    });
    const results = numberInReadingOrder(screen.issues).map((issue) => {
      const m = screen.measurements.find((x) => x.key === issue.measurementKey)!;
      const value = m.kind === "contrast" ? formatRatio(m.value) : `${m.value} px`;
      return {
        number: issue.number,
        kind: "measured" as const,
        principleId: issue.principleId,
        title: issue.title,
        detail: `"${m.label}" ${value}, needs ${m.kind === "contrast" ? formatRatio(m.threshold) : `${m.threshold} px`}`,
        severity: issue.severity,
        confidence: null,
        region: issue.region,
      };
    });
    // Measured planted problems only; target sizes only where controls were located.
    const expected = expectedOf(c).filter(
      (e) =>
        e.kind === "measured" &&
        checkOf(e.principleId) !== null &&
        (c.controls || checkOf(e.principleId) !== "target_size"),
    );
    const notes = c.controls ? [] : ["no located controls: target sizes skipped"];
    const score = scoreRun(expected, results, c);
    rows.push({
      name: c.name,
      expected,
      score,
      checks: screen.measurements.length,
      textLines: lines.length,
      controls: c.controls?.length ?? null,
      seconds: (performance.now() - started) / 1000,
      notes,
    });
    console.log(
      `${c.name}: ${lines.length} text lines, ${c.controls?.length ?? 0} controls, ${screen.measurements.length} checks; found ${score.found.length} of ${expected.length}, ${score.unexpected.length} unexpected`,
    );
  }
} finally {
  await stopOcr();
}

const tally = tallyByCheck(rows);
const planted = rows.reduce((s, r) => s + r.expected.length, 0);
const found = rows.reduce((s, r) => s + r.score.found.length, 0);
const unexpected = rows.reduce((s, r) => s + r.score.unexpected.length, 0);
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);
const cell = (t: string) => t.replace(/\|/g, "\\|");
const startedAt = new Date().toISOString();

const md: string[] = [
  `# Measured checks ${startedAt.slice(0, 10)}`,
  "",
  "Measured checks only (`pnpm eval:measured`), no Claude call. Contrast and text size: tesseract.js OCR on the screenshot, then measured from the pixels, as in a live review. Target size: controls located from the fixture page (standing in for Claude call 1), then measured from the pixels. Rules of a first run checklist.",
  "",
  `**Found ${found} of ${planted} planted measured problems (recall ${pct(recall(found, planted))}), ${unexpected} unexpected measured notes** on ${rows.length} cases.`,
  "",
  "| Check | Planted | Found | Recall | Unexpected |",
  "|---|---:|---:|---:|---:|",
  ...CHECKS.map(
    (c) =>
      `| ${CHECK_NAMES[c]} | ${tally[c].planted} | ${tally[c].found} | ${pct(recall(tally[c].found, tally[c].planted))} | ${tally[c].unexpected} |`,
  ),
  "",
  "## Per case",
  "",
  "| Case | Text lines (OCR) | Controls | Checks | Planted | Found | Unexpected | Time |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
  ...rows.map(
    (r) =>
      `| ${r.name} | ${r.textLines} | ${r.controls ?? "–"} | ${r.checks} | ${r.expected.length} | ${r.score.found.length} | ${r.score.unexpected.length} | ${r.seconds.toFixed(1)} s |`,
  ),
  "",
  "## Found",
  "",
  ...rows.flatMap((r) =>
    r.score.found.map(
      (f) => `* ${r.name} · ${f.expected.id} (${f.expected.principleId}): ${cell(f.result.detail)}`,
    ),
  ),
  "",
  "## Missed",
  "",
  ...(rows.some((r) => r.score.missed.length)
    ? rows.flatMap((r) =>
        r.score.missed.map((e) => `* ${r.name} · ${e.id} (${e.principleId}): ${cell(e.note)}`),
      )
    : ["Nothing missed."]),
  "",
  "## Unexpected",
  "",
  ...(unexpected
    ? rows.flatMap((r) =>
        r.score.unexpected.map(
          (u) => `* ${r.name} #${u.number} (${u.principleId}, ${u.severity}): ${cell(u.detail)}`,
        ),
      )
    : ["None."]),
  "",
  ...rows.flatMap((r) => r.notes.map((n) => `* ${r.name}: ${n}`)),
];

const runsDir = path.join(root, "eval/runs");
await mkdir(runsDir, { recursive: true });
const stem = await freshStem(runsDir, `${startedAt.slice(0, 10)}-measured`);
await writeFile(path.join(runsDir, `${stem}.md`), `${md.join("\n").trimEnd()}\n`);
console.log(
  `\nFound ${found} of ${planted} planted measured problems, ${unexpected} unexpected. eval/runs/${stem}.md written.`,
);
