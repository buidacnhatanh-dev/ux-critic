import { z } from "zod";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { removeScreenshots, saveScreenshot, screenshotPath } from "@/lib/api/files";
import { handle } from "@/lib/api/server";
import { ValidationError } from "@/lib/data/client";
import { sourceSettingsSchema } from "@/lib/db/json";
import { createReview, restartReview } from "@/lib/db/repo";
import { MEASURED_ONLY_COOKIE } from "@/lib/measured-only";
import { MAX_FILE_BYTES } from "@/lib/new-review";
import { toStoredPng } from "@/lib/pipeline/image";
import { claudeConnected, startReview } from "@/lib/pipeline/run";

const fields = z.object({
  projectId: z.string().optional(),
  newProjectName: z.string().optional(),
  versionName: z.string(),
  context: z.string().default(""),
  scale: z.enum(["1", "2", "3"]),
  sources: z.string(),
});
const retry = z.object({ retryOf: z.string().min(1) });

/** Whether this review may call Claude; without a key only after "measured checks only". */
async function evaluationAllowed(): Promise<boolean> {
  if (claudeConnected()) return true;
  const jar = await cookies();
  if (jar.get(MEASURED_ONLY_COOKIE)?.value === "1") return false;
  throw new ValidationError(
    "start",
    "Connect Claude first, or continue with measured checks only.",
  );
}

/** POST: create the version and start its review (multipart), or start again ({retryOf}). */
export function POST(request: Request) {
  return handle(async (db) => {
    const evaluation = await evaluationAllowed();

    if (request.headers.get("content-type")?.includes("application/json")) {
      const parsed = retry.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new ValidationError("body", "The request body is not valid.");
      const reviewId = restartReview(db, parsed.data.retryOf, { evaluation });
      void startReview(db, reviewId);
      return NextResponse.json({ reviewId }, { status: 201 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ValidationError("file", "Add a screenshot.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new ValidationError("file", "The file is larger than 20 MB. Use one up to 20 MB.");
    }
    const parsed = fields.safeParse(
      Object.fromEntries([...form.entries()].filter(([k]) => k !== "file")),
    );
    if (!parsed.success) throw new ValidationError("start", "The form is not complete.");
    const sources = sourceSettingsSchema.safeParse(JSON.parse(parsed.data.sources));
    if (!sources.success) throw new ValidationError("start", "The principle sets are not valid.");

    let image: Awaited<ReturnType<typeof toStoredPng>>;
    try {
      image = await toStoredPng(Buffer.from(await file.arrayBuffer()));
    } catch {
      throw new ValidationError(
        "file",
        "This file couldn't be read as a PNG, JPG or WebP image. Export the screen again.",
      );
    }

    const created = createReview(
      db,
      {
        projectId: parsed.data.projectId || null,
        newProjectName: parsed.data.newProjectName ?? null,
        versionName: parsed.data.versionName,
        context: parsed.data.context,
        scale: Number(parsed.data.scale) as 1 | 2 | 3,
        fileName: file.name,
        width: image.width,
        height: image.height,
        sources: sources.data,
        evaluation,
      },
      screenshotPath,
    );
    try {
      await saveScreenshot(created.screenshotPath, image.png);
    } catch (error) {
      await removeScreenshots([created.screenshotPath]);
      throw error;
    }
    void startReview(db, created.reviewId);
    return NextResponse.json({ reviewId: created.reviewId }, { status: 201 });
  });
}
