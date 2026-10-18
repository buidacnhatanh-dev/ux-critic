import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../axe";
import { RESULT_TIMEOUT, startReview } from "../live/upload";

// docs/08 §8: live mode started without ANTHROPIC_API_KEY.

test("every page goes to Connect Claude while no key is set", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Connect Claude to start reviewing" }),
  ).toBeVisible();
  await expect(page.getByText("No API key found")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto("/checklist");
  await expect(page).toHaveURL(/\/setup$/);
});

test("measured checks only: pages open, reviews run without Claude and say so", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByRole("button", { name: "Continue with measured checks only" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Review your first design" }),
  ).toBeVisible();

  await startReview(page, { project: "No key", fileName: "checkout.png" });
  await expect(page.getByRole("heading", { level: 1, name: "Review of v1" })).toBeVisible({
    timeout: RESULT_TIMEOUT,
  });
  await expect(page.getByText("Evaluation is off.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect Claude" })).toHaveAttribute(
    "href",
    "/setup",
  );
  await expect(page.getByText("No issues found")).toHaveCount(0);
  await expect(page.getByText(/Evaluated by/)).toHaveCount(0);

  // Contrast and text size are measured without a key: OCR finds the faint helper text.
  const filters = page.getByRole("group", { name: "Filter issues" });
  await expect(filters.getByRole("button", { name: "Measured 1" })).toBeVisible();
  await expect(filters.getByRole("button", { name: "Evaluated 0" })).toBeVisible();
  const card = page.locator("article").first();
  await card.locator("h3 button").click();
  await expect(card).toContainText('"We send your receipt to this address" is too faint');
  await expect(card).toContainText("measures 1.85 : 1 on #FFFFFF");
  await expect(card).toContainText("Measured from pixels");
  // Target sizes need Claude to find the controls, and the screen says so.
  await expect(
    page.getByText("Target sizes weren't measured: Claude finds the controls before code"),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  // The measurements are saved, pass or fail, with no target sizes among them.
  const reviewId = page.url().split("/").at(-1)!;
  const review = await (await page.request.get(`/api/reviews/${reviewId}`)).json();
  const kinds = new Set(review.measurements.map((m: { kind: string }) => m.kind));
  expect([...kinds].sort()).toEqual(["contrast", "text_size"]);
  expect(review.inputTokens).toBeNull();
});
