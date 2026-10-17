/**
 * docs/10: og:image from a captured Review screen. Takes the Checkout practice v1 review with the
 * faint text issue open, as a 1200 × 630 image, from a running demo build, and writes the Next.js file
 * convention images (app/opengraph-image.png, app/twitter-image.png).
 *
 *   node scripts/og-capture.ts [baseUrl]    default http://localhost:3000
 */
import { copyFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({
  // Laid out at 1800 × 945 so the issue card sits beside the screenshot, rendered at 1200 × 630.
  viewport: { width: 1800, height: 945 },
  deviceScaleFactor: 2 / 3,
  reducedMotion: "reduce",
});
await page.goto(`${base}/reviews/review-checkout-v1?issue=checkout-v1-t4-contrast`);
await page.locator("[aria-expanded=true]").waitFor();
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: "app/opengraph-image.png" });
copyFileSync("app/opengraph-image.png", "app/twitter-image.png");
await browser.close();
console.log("Wrote app/opengraph-image.png and app/twitter-image.png");
