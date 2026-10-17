/**
 * pnpm demo:data
 *
 * Writes demo/data.json with source "handwritten" (docs/10):
 * - measured issues and every measurement come from lib/pipeline/measure-screen.ts run on the
 *   captured PNGs (public/demo) at the boxes located by pnpm demo:capture. No number is typed.
 * - evaluated issues are the prose in demo/handwritten.json, written from the planted problems in
 *   eval/fixtures/*.expected.json, with the principle and region of the planted element.
 *
 * Safety checks: every planted measured problem must be found by the measuring code, and the
 * measuring code must not report anything that was not planted. Otherwise the script stops, so a
 * fixture change can never silently add or drop a measured issue.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatRatio, parseHex, toHex } from "../lib/contrast.ts";
import { demoDataSchema } from "../lib/data/demo-schema.ts";
import { loadRaw } from "../lib/pipeline/image.ts";
import { estimateFontSize, measureContrast } from "../lib/pipeline/measure.ts";
import { measureScreen, type MeasuredRules } from "../lib/pipeline/measure-screen.ts";
import { numberInReadingOrder } from "../lib/pipeline/order.ts";
import type { PixelBox } from "../lib/pipeline/raw-image.ts";

const root = path.resolve(import.meta.dirname, "..");
const readJson = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(path.join(root, file), "utf8")) as T;

type Handwritten = {
  rules: {
    key: string;
    id: string;
    text: string;
    kind: "measured" | "evaluated";
    metric: "target_size_min" | "text_size_min" | "contrast_min" | null;
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
  evaluated: Record<
    string,
    {
      planted: string;
      severity: "high" | "medium" | "low";
      confidence: "high" | "medium" | "low";
      title: string;
      detail: string;
      fix: string;
    }[]
  >;
  pushbacks: { versionId: string; planted: string; reason: string; createdAt: string }[];
};

type Capture = {
  width: number;
  height: number;
  scale: 1 | 2 | 3;
  textLines: { label: string; box: PixelBox; cssColor: string; cssFontSize: number }[];
  controls: { label: string; box: PixelBox }[];
  expected: { selector: string; box: PixelBox }[];
};

type Expected = {
  issues: { id: string; kind: "measured" | "evaluated"; principle_id: string; selector: string }[];
};

function overlaps(a: PixelBox, b: PixelBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function cssRgbToHex(css: string): string {
  const [r, g, b] = css.match(/\d+(\.\d+)?/g)!.map(Number);
  return toHex({ r: r!, g: g!, b: b! });
}

async function main() {
  const hand = await readJson<Handwritten>("demo/handwritten.json");
  const ruleByKey = new Map(hand.rules.map((r) => [r.key, r]));
  const ruleFor = (metric: string) => {
    const rule = hand.rules.find((r) => r.metric === metric);
    return rule && rule.threshold ? { ruleId: rule.id, min: rule.threshold } : null;
  };
  const measuredRules: MeasuredRules = {
    targetSize: ruleFor("target_size_min"),
    textSize: ruleFor("text_size_min"),
    contrast: ruleFor("contrast_min"),
  };
  /** "rule:<key>" in fixtures becomes "rule:<uuid>" in the data. */
  const principle = (id: string) => {
    if (!id.startsWith("rule:")) return id;
    const rule = ruleByKey.get(id.slice(5));
    if (!rule) throw new Error(`Unknown rule key in fixture: ${id}`);
    return `rule:${rule.id}`;
  };

  const sources = { nielsen: true, wcag: true, laws: true, mine: true };
  const out = {
    generatedBy:
      "scripts/demo-data.ts (pnpm demo:data) from demo/handwritten.json and public/demo/*.png",
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
  const report: string[] = [];

  for (const version of hand.versions) {
    const capture = await readJson<Capture>(`demo/captures/${version.fixture}.json`);
    const expected = await readJson<Expected>(`eval/fixtures/${version.fixture}.expected.json`);
    const screenshotUrl = `/demo/${version.fixture}.png`;
    const img = await loadRaw(path.join(root, "public", screenshotUrl));
    if (img.width !== capture.width || img.height !== capture.height) {
      throw new Error(
        `${version.fixture}: PNG size differs from the capture, run pnpm demo:capture`,
      );
    }
    const reviewId = `review-${version.id}`;
    const planted = new Map(
      expected.issues.map((issue, i) => [issue.id, { ...issue, box: capture.expected[i]!.box }]),
    );

    // Measured: computed from pixels.
    const screen = measureScreen({
      img,
      scale: capture.scale,
      textLines: capture.textLines,
      controls: capture.controls,
      rules: measuredRules,
    });
    const measurementId = (key: string) => `${version.id}-m-${key}`;
    for (const m of screen.measurements) {
      out.measurements.push({
        id: measurementId(m.key),
        reviewId,
        kind: m.kind,
        label: m.label,
        box: m.box,
        value: m.value,
        threshold: m.threshold,
        passes: m.passes,
      });
    }

    // Safety: planted measured problems are found, and nothing unplanned is reported.
    const plantedMeasured = [...planted.values()].filter((p) => p.kind === "measured");
    for (const p of plantedMeasured) {
      const found = screen.issues.some(
        (i) => i.principleId === principle(p.principle_id) && overlaps(i.region, p.box),
      );
      if (!found) problems.push(`${version.fixture}: planted "${p.id}" was not measured`);
    }
    for (const issue of screen.issues) {
      const isPlanted = plantedMeasured.some(
        (p) => principle(p.principle_id) === issue.principleId && overlaps(issue.region, p.box),
      );
      if (!isPlanted) {
        problems.push(
          `${version.fixture}: unplanned measured issue: ${issue.title} (${issue.detail})`,
        );
      }
    }

    // Sanity report: measured text colour and size against what the CSS says.
    let worstSize = 0;
    let colourMismatches = 0;
    for (const line of capture.textLines) {
      const c = measureContrast(img, line.box, capture.scale);
      if (c && toHex(c.text) !== cssRgbToHex(line.cssColor)) {
        const css = parseHex(cssRgbToHex(line.cssColor));
        const d = Math.hypot(c.text.r - css.r, c.text.g - css.g, c.text.b - css.b);
        if (d > 24) colourMismatches++;
      }
      const est = estimateFontSize(line.box.h, capture.scale);
      worstSize = Math.max(worstSize, Math.abs(est - line.cssFontSize));
    }
    const failing = screen.issues.map((i) => {
      const m = screen.measurements.find((x) => x.key === i.measurementKey)!;
      const shown = m.kind === "contrast" ? formatRatio(m.value) : `${m.value} px`;
      return `${m.kind} "${m.label}" ${shown}`;
    });
    report.push(
      `${version.fixture}: ${screen.measurements.length} checks, ${screen.issues.length} measured issues` +
        `${failing.length ? ` (${failing.join("; ")})` : ""}; font size estimate off by at most ` +
        `${worstSize.toFixed(1)} px; ${colourMismatches} text colours far from CSS`,
    );

    // Evaluated: handwritten prose for the planted problems.
    const evaluated = (hand.evaluated[version.id] ?? []).map((e) => {
      const p = planted.get(e.planted);
      if (!p || p.kind !== "evaluated")
        throw new Error(`${version.id}: no evaluated plant "${e.planted}"`);
      return {
        id: `${version.id}-${e.planted}`,
        reviewId,
        kind: "evaluated" as const,
        principleId: principle(p.principle_id),
        title: e.title,
        detail: e.detail,
        fix: e.fix,
        severity: e.severity,
        confidence: e.confidence,
        measurementId: null,
        region: p.box,
      };
    });
    const plantedEvaluated = [...planted.values()].filter((p) => p.kind === "evaluated");
    for (const p of plantedEvaluated) {
      if (!evaluated.some((e) => e.id === `${version.id}-${p.id}`)) {
        problems.push(`${version.fixture}: planted "${p.id}" has no handwritten note`);
      }
    }

    const measured = screen.issues.map((i) => ({
      id: `${version.id}-${i.measurementKey}`,
      reviewId,
      kind: "measured" as const,
      principleId: i.principleId,
      title: i.title,
      detail: i.detail,
      fix: i.fix,
      severity: i.severity,
      confidence: null,
      measurementId: measurementId(i.measurementKey),
      region: i.region,
    }));
    out.issues.push(...numberInReadingOrder([...measured, ...evaluated]));

    out.versions.push({
      id: version.id,
      projectId: version.projectId,
      sampleId: version.fixture,
      name: version.name,
      context: version.context,
      screenshotUrl,
      width: img.width,
      height: img.height,
      scale: capture.scale,
      createdAt: version.createdAt,
    });
    out.reviews.push({
      id: reviewId,
      versionId: version.id,
      status: "done",
      step: "place",
      error: null,
      sources: { sets: sources, ruleIds: hand.rules.map((r) => r.id) },
      model: null,
      inputTokens: null,
      outputTokens: null,
      startedAt: version.createdAt,
      finishedAt: version.createdAt,
      source: { kind: "handwritten" },
    });
    out.samples.push({
      id: version.fixture,
      name: version.sampleName,
      screenshotUrl,
      width: img.width,
      height: img.height,
      scale: capture.scale,
      reviewId,
    });
  }

  for (const p of hand.pushbacks) {
    out.pushbacks.push({
      issueId: `${p.versionId}-${p.planted}`,
      reason: p.reason,
      createdAt: p.createdAt,
    });
  }

  console.log(report.join("\n"));
  if (problems.length) {
    console.error(`\nNot written, fix these first:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  const data = demoDataSchema.parse(out);
  await writeFile(path.join(root, "demo/data.json"), `${JSON.stringify(data, null, 2)}\n`);
  console.log(
    `\ndemo/data.json: ${data.projects.length} projects, ${data.reviews.length} reviews, ` +
      `${data.issues.length} issues, ${data.measurements.length} measurements`,
  );
}

await main();
