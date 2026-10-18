/**
 * pnpm eval (docs/08): runs the real pipeline (OCR, Claude call 1, measuring, Claude call 2,
 * placing) on every case in eval/cases, 3 times each, scores the results against the planted
 * problems and writes eval/runs/<date>.md, <date>.results.json and <date>.review.json.
 *
 *   pnpm eval                          every case, 3 runs (real Claude calls, needs a key)
 *   pnpm eval --case login --runs 1    one case, one run
 *   pnpm eval --report eval/runs/<date>.results.json
 *                                      make the report again after marking unexpected notes
 *
 * Needs ANTHROPIC_API_KEY (read from .env.local) or UXC_FAKE_AI=1. With fake AI no call is made,
 * the files get a "-fake-ai" name and the report says its numbers mean nothing.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  renderReport,
  reviewTemplate,
  type EvalCaseResult,
  type EvalResults,
  type EvalRun,
  type ReviewFile,
} from "../lib/eval/report.ts";
import { toCasePrincipleId } from "../lib/eval/rule-keys.ts";
import { scoreRun } from "../lib/eval/score.ts";
import { FAKE_MODEL } from "../lib/fake-ai.ts";
import { modelId } from "../lib/pipeline/claude.ts";
import { expectedOf, freshStem, loadCases, parseArgs, root } from "./eval-cases.ts";
import { openRunner, requireClaude } from "./pipeline-run.ts";

const runsDir = path.join(root, "eval/runs");

async function writeOutputs(stem: string, results: EvalResults) {
  const reviewPath = path.join(runsDir, `${stem}.review.json`);
  const existing = await readFile(reviewPath, "utf8")
    .then((text) => JSON.parse(text) as ReviewFile)
    .catch(() => null);
  const review = reviewTemplate(results, existing);
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
  await writeFile(path.join(runsDir, `${stem}.md`), renderReport(results, review));
  return { review, md: path.relative(root, path.join(runsDir, `${stem}.md`)) };
}

async function reportOnly(resultsFile: string) {
  const results = JSON.parse(await readFile(path.resolve(resultsFile), "utf8")) as EvalResults;
  const stem = path.basename(resultsFile).replace(/\.results\.json$/, "");
  const { md, review } = await writeOutputs(stem, results);
  const marked = Object.values(review.notes).filter((n) => n.verdict).length;
  console.log(`${md} written (${marked} of ${Object.keys(review.notes).length} notes marked)`);
}

async function run(args: Map<string, string[]>) {
  const { fake } = requireClaude("pnpm eval");
  const runs = Number(args.get("runs")?.[0] ?? 3);
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs needs a whole number ≥ 1");
  const cases = await loadCases(args.get("case") ?? []);
  console.log(
    fake
      ? "Fake AI mode: no Claude calls, the evaluated notes are fixtures.\n"
      : `Real Claude calls with ${modelId()}: ${cases.length} cases × ${runs} runs × 2 calls.\n`,
  );

  const runner = await openRunner();
  const startedAt = new Date().toISOString();
  const caseResults: EvalCaseResult[] = [];
  try {
    for (const c of cases) {
      const expected = expectedOf(c);
      const result: EvalCaseResult = {
        name: c.name,
        description: c.description,
        width: c.width,
        height: c.height,
        expected,
        runs: [],
      };
      for (let n = 1; n <= runs; n++) {
        const { review, durationMs, rules } = await runner.review({
          projectName: `${c.name} run ${n}`,
          png: c.png,
          scale: c.scale,
          width: c.width,
          height: c.height,
          context: c.context,
        });
        const evalRun: EvalRun = {
          run: n,
          status: review.status,
          error: review.error?.message ?? null,
          model: review.model,
          durationMs,
          inputTokens: review.inputTokens,
          outputTokens: review.outputTokens,
          skippedChecks: (review.skippedChecks ?? []).map((s) => `${s.check}: ${s.reason}`),
          issues: review.issues.map((i) => ({
            number: i.number,
            kind: i.kind,
            principleId: toCasePrincipleId(i.principleId, rules),
            title: i.title,
            detail: i.detail,
            severity: i.severity,
            confidence: i.confidence,
            region: i.region,
          })),
        };
        result.runs.push(evalRun);
        const score = scoreRun(expected, evalRun.issues, c);
        console.log(
          `${c.name} run ${n}/${runs}: ${review.status}, ${evalRun.issues.length} notes, found ${score.found.length} of ${expected.length}, ${score.unexpected.length} unexpected, ${(durationMs / 1000).toFixed(1)} s`,
        );
      }
      caseResults.push(result);
    }
  } finally {
    await runner.close();
  }

  const results: EvalResults = {
    version: 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    fakeAi: fake,
    requestedModel: fake ? FAKE_MODEL : modelId(),
    runsPerCase: runs,
    cases: caseResults,
  };
  await mkdir(runsDir, { recursive: true });
  const stem = await freshStem(runsDir, `${startedAt.slice(0, 10)}${fake ? "-fake-ai" : ""}`);
  await writeFile(
    path.join(runsDir, `${stem}.results.json`),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  const { md } = await writeOutputs(stem, results);
  console.log(`\n${md} written. Mark unexpected notes in eval/runs/${stem}.review.json, then:`);
  console.log(`pnpm eval --report eval/runs/${stem}.results.json`);
}

const args = parseArgs(process.argv.slice(2));
const report = args.get("report")?.[0];
if (report) await reportOnly(report);
else await run(args);
