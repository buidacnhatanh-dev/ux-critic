import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../axe";

// Runs after the other live specs: changing the principle sets would change their reviews.
test("My checklist is saved in the database", async ({ page }) => {
  await page.goto("/checklist");
  const laws = page.getByRole("checkbox", { name: "Laws of UX" });
  await expect(laws).toBeChecked();
  await expect(page.getByText("[set prices in .env.local]")).toBeVisible();
  await laws.uncheck();
  await expect(
    page.getByRole("region", { name: "Notifications" }).getByText("Saved"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Laws of UX" })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Laws of UX" }).check();
  await expect(
    page.getByRole("region", { name: "Notifications" }).getByText("Saved"),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});
