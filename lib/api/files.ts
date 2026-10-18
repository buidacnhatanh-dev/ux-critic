/** Screenshot files in data/screenshots (live mode only). */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { screenshotsDir } from "../db/client.ts";

export function screenshotPath(versionId: string): string {
  return join(screenshotsDir(), `${versionId}.png`);
}

export async function saveScreenshot(path: string, png: Buffer): Promise<void> {
  await mkdir(screenshotsDir(), { recursive: true });
  await writeFile(path, png);
}

/** Removes screenshots; paths outside data/screenshots are never touched. */
export async function removeScreenshots(paths: string[]): Promise<void> {
  const dir = resolve(screenshotsDir());
  await Promise.all(
    paths.map(async (path) => {
      const rel = relative(dir, resolve(path));
      if (rel.startsWith("..") || rel === "") return;
      await rm(path, { force: true });
    }),
  );
}
