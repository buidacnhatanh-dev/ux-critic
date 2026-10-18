import { defineConfig, devices } from "@playwright/test";

const DEMO_PORT = 3100;
const LIVE_PORT = 3101;
const SETUP_PORT = 3102;

/** Live servers keep their database and screenshots here, emptied on every start. */
export const E2E_DATA_DIR = ".e2e-data";

const dev = (port: number) => `pnpm exec next dev --port ${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      // Demo mode: the sample projects, no API routes.
      name: "chromium",
      testIgnore: ["live/**", "setup/**"],
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEMO_PORT}` },
    },
    {
      // Live mode, fake AI: First use needs an empty database, so it runs before the rest.
      name: "live-first-use",
      testMatch: "live/first-use.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${LIVE_PORT}` },
    },
    {
      name: "live",
      testMatch: "live/**/*.spec.ts",
      testIgnore: ["live/first-use.spec.ts", "live/checklist.spec.ts"],
      dependencies: ["live-first-use"],
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${LIVE_PORT}` },
    },
    {
      name: "live-checklist",
      testMatch: "live/checklist.spec.ts",
      dependencies: ["live"],
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${LIVE_PORT}` },
    },
    {
      // Live mode without a key (docs/08 §8).
      name: "live-no-key",
      testMatch: "setup/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${SETUP_PORT}` },
    },
  ],
  webServer: [
    {
      // Dev server so /dev/ui is available. Demo mode, no key.
      command: dev(DEMO_PORT),
      url: `http://localhost:${DEMO_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { UXC_MODE: "demo", UXC_FAKE_AI: "1", ANTHROPIC_API_KEY: "", UXC_DIST_DIR: ".next-e2e" },
    },
    {
      // Live mode with fake AI: the real database and pipeline, Claude answers from fixtures.
      command: `rm -rf ${E2E_DATA_DIR}/live && ${dev(LIVE_PORT)}`,
      url: `http://localhost:${LIVE_PORT}/setup`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        UXC_MODE: "live",
        UXC_FAKE_AI: "1",
        ANTHROPIC_API_KEY: "",
        UXC_DATA_DIR: `${E2E_DATA_DIR}/live`,
        UXC_DIST_DIR: ".next-e2e-live",
      },
    },
    {
      command: `rm -rf ${E2E_DATA_DIR}/no-key && ${dev(SETUP_PORT)}`,
      url: `http://localhost:${SETUP_PORT}/setup`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        UXC_MODE: "live",
        UXC_FAKE_AI: "0",
        ANTHROPIC_API_KEY: "",
        UXC_DATA_DIR: `${E2E_DATA_DIR}/no-key`,
        UXC_DIST_DIR: ".next-e2e-setup",
      },
    },
  ],
});
