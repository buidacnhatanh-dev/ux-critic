import type { NextConfig } from "next";

/**
 * docs/10: API routes exist only in live mode. They are named route.live.ts, and that extension is
 * only known to Next.js when UXC_MODE=live, so a demo build (Vercel) has no API routes and never
 * bundles the database, the pipeline or the Claude SDK.
 */
const live = process.env.UXC_MODE?.trim() === "live";

const nextConfig: NextConfig = {
  // Playwright sets its own folder so tests can run next to a running `pnpm dev`.
  distDir: process.env.UXC_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: live ? ["live.ts", "tsx", "ts"] : ["tsx", "ts"],
};

export default nextConfig;
