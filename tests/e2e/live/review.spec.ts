import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../axe";
import { startReview } from "./upload";

const SCREENSHOTS = ".e2e-data/live/screenshots";

test("push back is saved in the database: kept after reload, undo removes it", async ({ page }) => {
  await startReview(page, { project: "Push back", fileName: "checkout.png" });
  await expect(page.getByRole("heading", { level: 1, name: "Review of v1" })).toBeVisible({
    timeout: 15_000,
  });
  const card = page.locator("article").nth(1);
  await card.locator("h3 button").click();
  await card.getByRole("button", { name: "I disagree with issue 2" }).click();
  await card
    .getByRole("textbox", { name: "Why is this not a problem here?" })
    .fill("People here pick from all five options.");
  await card.getByRole("button", { name: "Save reason" }).click();
  await expect(card).toContainText("Why I disagree");

  await page.reload();
  const again = page.locator("article").nth(1);
  await expect(again.locator("h3")).toContainText("I disagreed");
  await again.locator("h3 button").click();
  await expect(again).toContainText("People here pick from all five options.");
  await expectNoAxeViolations(page);
  await again.getByRole("button", { name: "Undo my reason for issue 2" }).click();
  await page.reload();
  await expect(page.locator("article").nth(1).locator("h3")).not.toContainText("I disagreed");
});

test("delete a project removes its screenshots from data/", async ({ page }) => {
  const reviewId = await startReview(page, { project: "To delete", fileName: "fake-empty.png" });
  await expect(page.getByRole("heading", { level: 2, name: "No issues found" })).toBeVisible({
    timeout: 15_000,
  });
  const review = await (await page.request.get(`/api/reviews/${reviewId}`)).json();
  const file = `${review.version.id}.png`;
  expect(readdirSync(SCREENSHOTS)).toContain(file);

  await page.getByRole("link", { name: "Back to project" }).click();
  await page.getByRole("button", { name: "Delete project" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete “To delete”?" });
  await expect(dialog.getByRole("button", { name: "Keep project" })).toBeFocused();
  await dialog.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(existsSync(`${SCREENSHOTS}/${file}`)).toBe(false);
  expect((await page.request.get(review.version.screenshotUrl)).status()).toBe(404);
  expect((await page.request.get(`/api/reviews/${reviewId}`)).status()).toBe(404);
});
