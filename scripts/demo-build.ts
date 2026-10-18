/**
 * pnpm demo:build (docs/10, live mode only, run by the owner):
 *
 * 1. Captures the demo screens from the fixtures (pnpm demo:capture)
 * 2. Runs the real pipeline on each (OCR, Claude call 1, measuring, Claude call 2, placing)
 * 3. Writes demo/data.json with source "claude" and the date
 *
 * Projects, version names, contexts, dates and checklist rules come from demo/handwritten.json, so
 * the demo keeps its sample projects. Everything a review says comes from the pipeline. The
 * prepared pushback is kept only when a note for the same planted problem exists; otherwise the
 * script says so. Nothing is written when a review fails or comes back partial.
 *
 *   pnpm demo:build                      needs UXC_MODE=live and ANTHROPIC_API_KEY (.env.local)
 *   UXC_MODE=live UXC_FAKE_AI=1 pnpm demo:build --out <file>
 *                                        tries it without a key; fake notes never go to
 *                                        demo/data.json, so --out is required
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoDataSchema } from "../lib/data/demo-schema.ts";
import type { Rule } from "../lib/data/types.ts";
import { toCasePrincipleId } from "../lib/eval/rule-keys.ts";
import { scoreRun } from "../lib/eval/score.ts";
import { resolveMode } from "../lib/mode.ts";
import type { Capture, FixtureExpected } from "./capture.ts";
import { captureDemo } from "./demo-capture.ts";
import { parseArgs } from "./eval-cases.ts";
import { openRunner, requireClaude } from "./pipeline-run.ts";

const root = path.resolve(import.meta.dirname, "..");
const readJson = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(path.join(root, file), "utf8")) as T;

type Handwritten = {
  rules: {
    key: string;
    id: string;
    text: string;
    kind: "measured" | "evaluated";
    metric: Rule["metric"];
    threshold: number | null;
  }[];
  projects: { id: string; name: string; createdAt: string }[];
  versions: {
    id: string;
    projectId: string;
    name: string;
    fixture: string;
    sampleName: string;
    context: string;
    createdAt: string;
  }[];
  pushbacks: { versionId: string; planted: string; reason: string; createdAt: string }[];
};

const args = parseArgs(process.argv.slice(2));
const out = args.get("out")?.[0];
if (resolveMode(process.env) !== "live") {
  console.error("pnpm demo:build runs in live mode only: set UXC_MODE=live in .env.local.");
  process.exit(1);
}
const { fake } = requireClaude("pnpm demo:build");
if (fake && !out) {
  console.error(
    "Fake AI notes must never become the demo. Pass --out <file> to write them somewhere else.",
  );
  process.exit(1);
}

await captureDemo();
const hand = await readJson<Handwritten>("demo/handwritten.json");
const keyToId = new Map(hand.rules.map((r) => [r.key, r.id]));
/** `rule:<key>` from the pipeline becomes the demo's stable rule id. */
const demoPrincipleId = (caseId: string) => {
  if (!caseId.startsWith("rule:")) return caseId;
  const id = keyToId.get(caseId.slice(5));
  if (!id) throw new Error(`A note uses a rule the demo does not have: ${caseId}`);
  return `rule:${id}`;
};

const generatedAt = new Date().toISOString();
const sources = { nielsen: true, wcag: true, laws: true, mine: true };
const data = {
  generatedBy: `scripts/demo-build.ts (pnpm demo:build) on ${generatedAt.slice(0, 10)}: the real pipeline on public/demo/*.png`,
  settings: { sources },
  rules: hand.rules.map((r, i) => ({
    id: r.id,
    text: r.text,
    kind: r.kind,
    metric: r.metric,
    threshold: r.threshold,
    position: i + 1,
    enabled: true,
  })),
  samples: [] as unknown[],
  projects: hand.projects,
  versions: [] as unknown[],
  reviews: [] as unknown[],
  measurements: [] as unknown[],
  issues: [] as unknown[],
  pushbacks: [] as unknown[],
};

const problems: string[] = [];
const notes: string[] = [];
const runner = await openRunner();
try {
  for (const version of hand.versions) {
    const capture = await readJson<Capture>(`demo/captures/${version.fixture}.json`);
    const expected = await readJson<FixtureExpected>(
      `eval/fixtures/${version.fixture}.expected.json`,
    );
    const screenshotUrl = `/demo/${version.fixture}.png`;
    const { review, durationMs, rules } = await runner.review({
      projectName: version.id,
      png: path.join(root, "public", screenshotUrl),
      scale: capture.scale as 1 | 2 | 3,
      width: capture.width,
      height: capture.height,
      context: version.context,
    });
    if (review.status !== "done") {
      problems.push(
        `${version.id}: review ${review.status}${review.error ? ` (${review.error.message})` : ""}`,
      );
      continue;
    }
    const reviewId = `review-${version.id}`;
    const measurementIds = new Map<string, string>();
    review.measurements.forEach((m, i) => {
      const id = `${version.id}-m-${i + 1}`;
      measurementIds.set(m.id, id);
      data.measurements.push({
        id,
        reviewId,
        kind: m.kind,
        label: m.label,
        box: m.box,
        value: m.value,
        threshold: m.threshold,
        passes: m.passes,
      });
    });
    const issues = review.issues.map((issue) => ({
      id: `${version.id}-${issue.number}`,
      reviewId,
      number: issue.number,
      kind: issue.kind,
      principleId: demoPrincipleId(toCasePrincipleId(issue.principleId, rules)),
      caseId: toCasePrincipleId(issue.principleId, rules),
      title: issue.title,
      detail: issue.detail,
      fix: issue.fix,
      severity: issue.severity,
      confidence: issue.confidence,
      measurementId: issue.measurementId ? (measurementIds.get(issue.measurementId) ?? null) : null,
      region: issue.region,
    }));
    data.issues.push(...issues.map(({ caseId: _, ...issue }) => issue));

    // The prepared pushback goes on the note for the same planted problem, if there is one.
    for (const p of hand.pushbacks.filter((x) => x.versionId === version.id)) {
      const i = expected.issues.findIndex((e) => e.id === p.planted);
      const planted = expected.issues[i]!;
      const score = scoreRun(
        [
          {
            id: planted.id,
            kind: planted.kind,
            principleId: planted.principle_id,
            note: planted.note,
            box: capture.expected[i]!.box,
          },
        ],
        issues.map((x) => ({ ...x, principleId: x.caseId })),
        capture,
      );
      const match = score.found[0];
      if (match) {
        data.pushbacks.push({
          issueId: `${version.id}-${match.result.number}`,
          reason: p.reason,
          createdAt: p.createdAt,
        });
      } else {
        notes.push(
          `${version.id}: no note for "${p.planted}", so its prepared pushback is not in the demo`,
        );
      }
    }

    data.versions.push({
      id: version.id,
      projectId: version.projectId,
      sampleId: version.fixture,
      name: version.name,
      context: version.context,
      screenshotUrl,
      width: capture.width,
      height: capture.height,
      scale: capture.scale,
      createdAt: version.createdAt,
    });
    data.reviews.push({
      id: reviewId,
      versionId: version.id,
      status: "done",
      step: "place",
      error: null,
      sources: { sets: sources, ruleIds: hand.rules.map((r) => r.id) },
      model: review.model,
      inputTokens: review.inputTokens,
      outputTokens: review.outputTokens,
      // The sample date, plus how long the review really took.
      startedAt: version.createdAt,
      finishedAt: new Date(Date.parse(version.createdAt) + durationMs).toISOString(),
      source: { kind: "claude", generatedAt },
    });
    data.samples.push({
      id: version.fixture,
      name: version.sampleName,
      screenshotUrl,
      width: capture.width,
      height: capture.height,
      scale: capture.scale,
      reviewId,
    });
    const measured = issues.filter((x) => x.kind === "measured").length;
    console.log(
      `${version.id}: ${issues.length} notes (${measured} measured, ${issues.length - measured} evaluated), ${review.measurements.length} checks, ${(durationMs / 1000).toFixed(1)} s, model ${review.model ?? "none"}`,
    );
  }
} finally {
  await runner.close();
}

if (notes.length) console.log(`\n${notes.join("\n")}`);
if (problems.length) {
  console.error(`\nNothing written. These reviews did not finish:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
const valid = demoDataSchema.parse(data);
const target = out ? path.resolve(out) : path.join(root, "demo/data.json");
await writeFile(target, `${JSON.stringify(valid, null, 2)}\n`);
const shown = target.startsWith(root) ? path.relative(root, target) : target;
console.log(
  `\n${shown}: ${valid.reviews.length} reviews, ${valid.issues.length} notes, ${valid.measurements.length} measurements${fake ? " (fake AI notes)" : ""}. Read every review before you commit and redeploy.`,
);
