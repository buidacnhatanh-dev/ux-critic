import { expect, test } from "@playwright/test";

const SCREENS: [string, string][] = [
  ["/", "Projects"],
  ["/projects/checkout-practice", "Checkout practice"],
  ["/reviews/review-checkout-v1", "Review of v1"],
  ["/reviews/review-checkout-v3", "Review of v3"],
  ["/projects/checkout-practice/compare?from=checkout-v1&to=checkout-v2", "What changed"],
];

for (const [path, heading] of SCREENS) {
  test(`${path} reflows at 375 px without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
}
