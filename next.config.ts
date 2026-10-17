import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright sets its own folder so tests can run next to a running `pnpm dev`.
  distDir: process.env.UXC_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
