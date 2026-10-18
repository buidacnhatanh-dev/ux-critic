import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../axe";
import { startReview } from "../live/upload";

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
    timeout: 15_000,
  });
  await expect(page.getByText("Evaluation is off.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect Claude" })).toHaveAttribute(
    "href",
    "/setup",
  );
  await expect(page.getByText("No issues found")).toHaveCount(0);
  await expect(page.getByText(/Evaluated by/)).toHaveCount(0);
  await expectNoAxeViolations(page);
});
