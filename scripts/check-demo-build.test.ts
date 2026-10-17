import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fakeBuild(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "uxc-build-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

function check(dir: string, env: Record<string, string> = {}) {
  try {
    const out = execFileSync("node", ["scripts/check-demo-build.ts", dir], {
      env: { ...process.env, UXC_MODE: "demo", ANTHROPIC_API_KEY: "", ...env },
      stdio: "pipe",
    });
    return { ok: true, out: out.toString() };
  } catch (error) {
    return { ok: false, out: String((error as { stderr: Buffer }).stderr) };
  }
}

const clean = {
  "app-path-routes-manifest.json": JSON.stringify({ "/page": "/" }),
  "server/app/page.js": "export default 1",
  "server/app/page.js.nft.json": JSON.stringify({ files: ["../../node_modules/react/index.js"] }),
  "static/chunks/a.js": 'children:"ANTHROPIC_API_KEY=your-key-here"',
};

describe("check-demo-build", () => {
  it("passes a clean demo build, including the Connect Claude instructions", () => {
    expect(check(fakeBuild(clean)).ok).toBe(true);
  });

  it("fails on an API route", () => {
    const dir = fakeBuild({
      ...clean,
      "app-path-routes-manifest.json": JSON.stringify({ "/api/reviews/route": "/api/reviews" }),
    });
    expect(check(dir)).toMatchObject({ ok: false, out: expect.stringContaining("/api/reviews") });
  });

  it("fails when a route traces the database or the pipeline", () => {
    const dir = fakeBuild({
      ...clean,
      "server/app/page.js.nft.json": JSON.stringify({
        files: ["../../node_modules/better-sqlite3/lib/index.js"],
      }),
      "server/chunks/x.js": 'require("../lib/pipeline/run.ts")',
    });
    const result = check(dir);
    expect(result.ok).toBe(false);
    expect(result.out).toContain("better-sqlite3");
    expect(result.out).toContain("pipeline");
  });

  it("fails when the browser reads the key or calls the API", () => {
    const dir = fakeBuild({ ...clean, "static/chunks/b.js": 'fetch("https://api.anthropic.com")' });
    expect(check(dir).ok).toBe(false);
  });

  it("refuses a demo build with an API key in the environment", () => {
    expect(check(fakeBuild(clean), { ANTHROPIC_API_KEY: "x" }).ok).toBe(false);
  });
});
