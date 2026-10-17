/**
 * Shape of demo/data.json: the tables from docs/02 in camelCase, plus `source` per review and the
 * sample screens. scripts/demo-data.ts validates before writing; a unit test checks the file.
 */
import { z } from "zod";

const box = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
const severity = z.enum(["high", "medium", "low"]);
const isoDate = z.iso.datetime();

export const demoDataSchema = z
  .object({
    generatedBy: z.string(),
    settings: z.object({
      sources: z.object({
        nielsen: z.boolean(),
        wcag: z.boolean(),
        laws: z.boolean(),
        mine: z.boolean(),
      }),
    }),
    rules: z.array(
      z.object({
        id: z.uuid(),
        text: z.string().min(1),
        kind: z.enum(["measured", "evaluated"]),
        metric: z.enum(["target_size_min", "text_size_min", "contrast_min"]).nullable(),
        threshold: z.number().positive().nullable(),
        position: z.number().int(),
        enabled: z.boolean(),
      }),
    ),
    samples: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        screenshotUrl: z.string().startsWith("/demo/"),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        scale: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        reviewId: z.string(),
      }),
    ),
    projects: z.array(z.object({ id: z.string(), name: z.string().min(1), createdAt: isoDate })),
    versions: z.array(
      z.object({
        id: z.string(),
        projectId: z.string(),
        sampleId: z.string(),
        name: z.string().min(1),
        context: z.string(),
        screenshotUrl: z.string().startsWith("/demo/"),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        scale: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        createdAt: isoDate,
      }),
    ),
    reviews: z.array(
      z.object({
        id: z.string(),
        versionId: z.string(),
        status: z.enum(["queued", "running", "done", "partial", "failed"]),
        step: z.enum(["prepare", "measure", "evaluate", "place"]),
        error: z.object({ message: z.string(), detail: z.string().nullable() }).nullable(),
        sources: z.object({
          sets: z.object({
            nielsen: z.boolean(),
            wcag: z.boolean(),
            laws: z.boolean(),
            mine: z.boolean(),
          }),
          ruleIds: z.array(z.string()),
        }),
        model: z.string().nullable(),
        inputTokens: z.number().int().nullable(),
        outputTokens: z.number().int().nullable(),
        startedAt: isoDate,
        finishedAt: isoDate.nullable(),
        source: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("handwritten") }),
          z.object({ kind: z.literal("claude"), generatedAt: isoDate }),
        ]),
      }),
    ),
    measurements: z.array(
      z.object({
        id: z.string(),
        reviewId: z.string(),
        kind: z.enum(["contrast", "text_size", "target_size"]),
        label: z.string(),
        box,
        value: z.number(),
        threshold: z.number(),
        passes: z.boolean(),
      }),
    ),
    issues: z.array(
      z.object({
        id: z.string(),
        reviewId: z.string(),
        number: z.number().int().positive(),
        kind: z.enum(["measured", "evaluated"]),
        principleId: z.string().regex(/^(nielsen-\d+|wcag-[\d.]+|law-[a-z-]+|rule:.+)$/),
        title: z.string().min(1),
        detail: z.string().min(1),
        fix: z.string().min(1),
        severity,
        confidence: severity.nullable(),
        measurementId: z.string().nullable(),
        region: box.nullable(),
      }),
    ),
    pushbacks: z.array(
      z.object({ issueId: z.string(), reason: z.string().trim().min(1), createdAt: isoDate }),
    ),
  })
  .superRefine((data, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
    const projects = ids(data.projects);
    const versions = ids(data.versions);
    const reviews = ids(data.reviews);
    const measurements = ids(data.measurements);
    const issues = ids(data.issues);
    for (const v of data.versions)
      if (!projects.has(v.projectId)) issue(`version ${v.id}: no project`);
    for (const r of data.reviews)
      if (!versions.has(r.versionId)) issue(`review ${r.id}: no version`);
    for (const m of data.measurements)
      if (!reviews.has(m.reviewId)) issue(`measurement ${m.id}: no review`);
    for (const i of data.issues) {
      if (!reviews.has(i.reviewId)) issue(`issue ${i.id}: no review`);
      // Product rules: measured has a measurement and no confidence; evaluated has a confidence.
      if (i.kind === "measured" && (!i.measurementId || !measurements.has(i.measurementId)))
        issue(`issue ${i.id}: measured without a measurement`);
      if (i.kind === "measured" && i.confidence !== null)
        issue(`issue ${i.id}: measured with confidence`);
      if (i.kind === "evaluated" && i.confidence === null)
        issue(`issue ${i.id}: evaluated without confidence`);
    }
    for (const p of data.pushbacks)
      if (!issues.has(p.issueId)) issue(`pushback ${p.issueId}: no issue`);
    for (const s of data.samples) if (!reviews.has(s.reviewId)) issue(`sample ${s.id}: no review`);
  });

export type DemoData = z.infer<typeof demoDataSchema>;
