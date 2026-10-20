/**
 * pnpm eval:measured: scores only the measured checks that need no Claude call, contrast and
 * text size (docs/04), on every case in eval/cases, without any key. Writes
 * eval/runs/<date>-measured.md.
 *
 * Exactly the live path of "measured checks only": tesseract.js finds the text lines on the PNG,
 * then lib/pipeline/measure-screen.ts measures contrast and text size from the pixels, with the
 * rules of a first run checklist (contrast 4.5 : 1, body text 16 px). Target size is left out: it
 * needs Claude call 1 to find the controls. Results are matched to the planted contrast and text
 * size problems with the Compare matcher (lib/eval/score.ts). Deterministic, so one run per case.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatRatio } from "../lib/contrast.ts";
import { checkOf, seedMeasuredRules, tallyByCheck, TEXT_CHECKS } from "../lib/eval/measured.ts";
import { recall, scoreRun, type ExpectedIssue, type RunScore } from "../lib/eval/score.ts";
import { loadRaw } from "../lib/pipeline/image.ts";
import { fromOcr, measureScreen } from "../lib/pipeline/measure-screen.ts";
import { findTextLines, stopOcr } from "../lib/pipeline/ocr.ts";
import { numberInReadingOrder } from "../lib/pipeline/order.ts";
import { expectedOf, freshStem, loadCases, parseArgs, root } from "./eval-cases.ts";

const CHECK_NAMES: Record<string, string> = { contrast: "Contrast", text_size: "Text size" };
const isTextCheck = (principleId: string) => {
  const check = checkOf(principleId);
  return check !== null && TEXT_CHECKS.includes(check);
};

const args = parseArgs(process.argv.slice(2));
const cases = await loadCases(args.get("case") ?? []);
const rules = { ...seedMeasuredRules(), targetSize: null };

type Row = {
  name: string;
  expected: ExpectedIssue[];
  score: RunScore;
  checks: number;
  textLines: number;
  seconds: number;
};
const rows: Row[] = [];
try {
  for (const c of cases) {
    const started = performance.now();
    const png = await readFile(c.png);
    const lines = await findTextLines(png);
    const screen = measureScreen({
      img: await loadRaw(png),
      scale: c.scale,
      textLines: fromOcr(lines, c.scale),
      controls: [],
      rules,
    });
    const results = numberInReadingOrder(screen.issues).map((issue) => {
      const m = screen.measurements.find((x) => x.key === issue.measurementKey)!;
      const shown = (v: number) => (m.kind === "contrast" ? formatRatio(v) : `${v} px`);
      return {
        number: issue.number,
        kind: "measured" as const,
        principleId: issue.principleId,
        title: issue.title,
        // A note wider than its measurement is a line OCR split; its title names every piece.
        detail: `${issue.region.w > m.box.w ? issue.title : `"${m.label}"`}: ${shown(m.value)}, needs ${shown(m.threshold)}`,
        severity: issue.severity,
        confidence: null,
        region: issue.region,
      };
    });
    const expected = expectedOf(c).filter(
      (e) => e.kind === "measured" && isTextCheck(e.principleId),
    );
    const score = scoreRun(expected, results, c);
    rows.push({
      name: c.name,
      expected,
      score,
      checks: screen.measurements.length,
      textLines: lines.length,
      seconds: (performance.now() - started) / 1000,
    });
    console.log(
      `${c.name}: ${lines.length} text lines, ${screen.measurements.length} checks; found ${score.found.length} of ${expected.length}, missed ${score.missed.length}, ${score.unexpected.length} unexpected`,
    );
  }
} finally {
  await stopOcr();
}

const tally = tallyByCheck(rows);
const sum = (pick: (r: Row) => number) => rows.reduce((s, r) => s + pick(r), 0);
const planted = sum((r) => r.expected.length);
const found = sum((r) => r.score.found.length);
const missed = sum((r) => r.score.missed.length);
const unexpected = sum((r) => r.score.unexpected.length);
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);
const cell = (t: string) => t.replace(/\|/g, "\\|");
const startedAt = new Date().toISOString();

const md: string[] = [
  `# Measured checks ${startedAt.slice(0, 10)}`,
  "",
  "Contrast and text size only (`pnpm eval:measured`), no Claude call: tesseract.js OCR on the screenshot, then measured from the pixels, as in a live review without a key. Rules of a first run checklist. Target size is not scored here: it needs Claude call 1 to find the controls. Matching: the Compare matcher (same principle, region IoU ≥ 0.25 or similar title).",
  "",
  `**Total: found ${found} of ${planted} planted problems (recall ${pct(recall(found, planted))}), missed ${missed}, ${unexpected} unexpected** on ${rows.length} cases.`,
  "",
  "| Check | Planted | Found | Missed | Unexpected |",
  "|---|---:|---:|---:|---:|",
  ...TEXT_CHECKS.map(
    (c) =>
      `| ${CHECK_NAMES[c]} | ${tally[c].planted} | ${tally[c].found} | ${tally[c].planted - tally[c].found} | ${tally[c].unexpected} |`,
  ),
  `| **Total** | ${planted} | ${found} | ${missed} | ${unexpected} |`,
  "",
  "## Per case",
  "",
  "| Case | Text lines (OCR) | Checks | Planted | Found | Missed | Unexpected |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...rows.map(
    (r) =>
      `| ${r.name} | ${r.textLines} | ${r.checks} | ${r.expected.length} | ${r.score.found.length} | ${r.score.missed.length} | ${r.score.unexpected.length} |`,
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
  ...(missed
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
];

const runsDir = path.join(root, "eval/runs");
await mkdir(runsDir, { recursive: true });
const stem = await freshStem(runsDir, `${startedAt.slice(0, 10)}-measured`);
await writeFile(path.join(runsDir, `${stem}.md`), `${md.join("\n").trimEnd()}\n`);
console.log(
  `\nFound ${found} of ${planted}, missed ${missed}, ${unexpected} unexpected. eval/runs/${stem}.md written.`,
);
