import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * docs/10: smoke test against the production build in demo mode, as Vercel runs it.
 * Builds into its own folder, checks the build, then serves it with `next start`.
 */
export default defineConfig({
  testDir: "tests/smoke",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next build && node scripts/check-demo-build.ts && pnpm exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { UXC_MODE: "demo", ANTHROPIC_API_KEY: "", UXC_FAKE_AI: "0", UXC_DIST_DIR: ".next-smoke" },
  },
});
