/**
 * Runs the live pipeline (lib/pipeline/run.ts) on a PNG outside the app, in a throwaway
 * database: used by pnpm eval and pnpm demo:build. Real Claude calls unless UXC_FAKE_AI=1.
 */
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDb } from "../lib/db/client.ts";
import { createReview, getChecklist, getReview } from "../lib/db/repo.ts";
import { DEFAULT_SOURCES } from "../lib/db/seed.ts";
import type { ReviewDetail, Rule, Scale } from "../lib/data/types.ts";
import { isFakeAi } from "../lib/fake-ai.ts";
import { stopOcr } from "../lib/pipeline/ocr.ts";
import { runReview } from "../lib/pipeline/run.ts";

/** Stops unless a key is set or fake AI mode is on. */
export function requireClaude(command: string): { fake: boolean } {
  const fake = isFakeAi();
  if (!fake && !process.env.ANTHROPIC_API_KEY?.trim()) {
    console.error(
      `${command} calls Claude and needs ANTHROPIC_API_KEY in .env.local. To try it without a key, run it with UXC_FAKE_AI=1.`,
    );
    process.exit(1);
  }
  return { fake };
}

export type PipelineRunner = {
  review(input: {
    projectName: string;
    png: string;
    scale: Scale;
    width: number;
    height: number;
    context: string;
  }): Promise<{ review: ReviewDetail; durationMs: number; rules: Rule[] }>;
  close(): Promise<void>;
};

export async function openRunner(): Promise<PipelineRunner> {
  const work = await mkdtemp(path.join(tmpdir(), "uxc-run-"));
  const { db, sqlite } = openDb(path.join(work, "run.db"));
  return {
    async review(input) {
      const { reviewId, screenshotPath } = createReview(
        db,
        {
          projectId: null,
          newProjectName: input.projectName,
          versionName: "v1",
          context: input.context,
          scale: input.scale,
          fileName: path.basename(input.png),
          width: input.width,
          height: input.height,
          sources: DEFAULT_SOURCES,
          evaluation: true,
        },
        (versionId) => path.join(work, `${versionId}.png`),
      );
      await copyFile(input.png, screenshotPath);
      const started = performance.now();
      await runReview(db, reviewId);
      const durationMs = Math.round(performance.now() - started);
      return { review: getReview(db, reviewId), durationMs, rules: getChecklist(db).rules };
    },
    async close() {
      sqlite.close();
      await stopOcr();
      await rm(work, { recursive: true, force: true });
    },
  };
}
