import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../axe";
import { RESULT_TIMEOUT, startReview } from "./upload";

// docs/08 §1, live mode with fake AI: First use → New review → upload → Reviewing → Review.
test("first review: upload, watch the steps, get numbered evaluated notes", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Review your first design" }),
  ).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Start a review" }).click();
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByText("Drop a screenshot or paste it")).toBeVisible();

  await startReview(page, { project: "Coffee shop", fileName: "checkout.png" });

  // Reviewing (9) while the fake call waits 500 ms, then the result.
  await expect(
    page.getByRole("heading", { level: 1, name: /^(Reviewing|Review of) v1/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Review of v1" })).toBeVisible({
    timeout: RESULT_TIMEOUT,
  });
  const filters = page.getByRole("group", { name: "Filter issues" });
  await expect(filters.getByRole("button", { name: "All 4" })).toBeVisible();
  await expect(filters.getByRole("button", { name: "Measured 1" })).toBeVisible();
  await expect(filters.getByRole("button", { name: "Evaluated 3" })).toBeVisible();
  await expect(page.locator("article h3 button")).toHaveCount(4);
  // The model from the (fake) API response.
  await expect(page.getByText("Evaluated by fake-ai")).toBeVisible();
  await expect(page.locator("article").first()).toContainText(
    "Field labels disappear while typing",
  );
  // Measured from the pixels: the faint helper text, in reading order after the labels note.
  const measured = page.locator("article").nth(1);
  await measured.locator("h3 button").click();
  await expect(measured).toContainText('"We send your receipt to this address" is too faint');
  await expect(measured).toContainText("measures 1.85 : 1 on #FFFFFF");
  await expect(measured).toContainText("Measured from pixels");
  await expect(page.getByText(/weren't measured/)).toHaveCount(0);

  // The screenshot comes from data/ through the API.
  const image = page.getByRole("img", { name: /Screenshot of Coffee shop v1/ });
  await expect(image).toHaveAttribute("src", /^\/api\/screenshots\//);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2560);
  await expectNoAxeViolations(page);

  // The project shows on Projects with its counts.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Coffee shop/ }).first()).toBeVisible();
  await expectNoAxeViolations(page);
});
