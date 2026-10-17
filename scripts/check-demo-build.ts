/**
 * docs/10: the demo deployment must not contain API routes, the database, the pipeline or the
 * Claude SDK, and the browser bundle must never mention the API key. Runs after `next build`
 * (Vercel runs it through `vercel-build`, so a bad build never deploys).
 *
 *   node scripts/check-demo-build.ts [distDir]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const distDir = process.argv[2] ?? process.env.UXC_DIST_DIR ?? ".next";

if (process.env.UXC_MODE?.trim() === "live") {
  console.log("check-demo-build: UXC_MODE=live, nothing to check.");
  process.exit(0);
}
if (process.env.ANTHROPIC_API_KEY?.trim()) {
  fail(["ANTHROPIC_API_KEY is set for a demo build. Remove it from the environment (docs/10)."]);
}
if (!existsSync(distDir)) fail([`No build found in ${distDir}. Run next build first.`]);

/** Modules and paths that only live mode may use. */
const SERVER_FORBIDDEN = [
  /better-sqlite3/,
  /tesseract/,
  /@anthropic-ai[\\/]sdk/,
  /drizzle-orm/,
  /[\\/]lib[\\/]pipeline[\\/]/,
  /[\\/]lib[\\/]db[\\/]/,
];
/**
 * Never in the browser: reading the key, a key value, or calls to the API. (The words
 * "ANTHROPIC_API_KEY=your-key-here" on Connect Claude are instructions, not a key.)
 */
const CLIENT_FORBIDDEN = [
  /process\.env\.ANTHROPIC_API_KEY/,
  /sk-ant-[A-Za-z0-9_-]{8,}/,
  /api\.anthropic\.com/,
  ...SERVER_FORBIDDEN,
];

function files(dir: string, test: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, test);
    return test(entry.name) ? [path] : [];
  });
}

function fail(problems: string[]): never {
  console.error("check-demo-build failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}

const problems: string[] = [];

// 1. No API routes at all.
for (const manifest of ["app-path-routes-manifest.json", "server/app-paths-manifest.json"]) {
  const path = join(distDir, manifest);
  if (!existsSync(path)) continue;
  const routes = Object.keys(JSON.parse(readFileSync(path, "utf8")) as Record<string, string>);
  for (const route of routes)
    if (/^\/api(\/|$)/.test(route)) problems.push(`API route in ${manifest}: ${route}`);
}

// 2. Server code of the app routes: compiled chunks and the files each route traces.
const serverDir = join(distDir, "server");
for (const file of files(serverDir, (n) => n.endsWith(".js"))) {
  const text = readFileSync(file, "utf8");
  for (const pattern of SERVER_FORBIDDEN) {
    if (pattern.test(text)) problems.push(`${relative(distDir, file)} contains ${pattern}`);
  }
}
for (const file of files(join(serverDir, "app"), (n) => n.endsWith(".nft.json"))) {
  const traced = (JSON.parse(readFileSync(file, "utf8")) as { files: string[] }).files;
  for (const path of traced) {
    for (const pattern of SERVER_FORBIDDEN) {
      if (pattern.test(path)) problems.push(`${relative(distDir, file)} traces ${path}`);
    }
  }
}

// 3. Browser chunks.
for (const file of files(join(distDir, "static"), (n) => n.endsWith(".js"))) {
  const text = readFileSync(file, "utf8");
  for (const pattern of CLIENT_FORBIDDEN) {
    if (pattern.test(text)) problems.push(`${relative(distDir, file)} contains ${pattern}`);
  }
}

if (problems.length) fail(problems);
console.log(`check-demo-build: ${distDir} has no API routes, database, pipeline, SDK or key.`);
