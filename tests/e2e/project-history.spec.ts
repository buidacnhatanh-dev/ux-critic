import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

test("Project history lists versions, issues per version and where I disagreed", async ({
  page,
}) => {
  await page.goto("/projects/checkout-practice");
  await expect(page.getByRole("heading", { level: 1, name: "Checkout practice" })).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/");

  const versions = page.getByRole("region", { name: "Versions" }).getByRole("article");
  await expect(versions).toHaveCount(3);
  await expect(versions.nth(0).getByRole("heading", { name: "v3" })).toBeVisible();
  await expect(versions.nth(0)).toContainText("Latest");
  await expect(versions.nth(0)).toContainText("Reviewed 14 Oct");
  await expect(versions.nth(0)).toContainText("Checkout after fixing the payment choices");
  await expect(versions.nth(2)).toContainText("High 2");
  await expect(versions.nth(1)).not.toContainText("Latest");

  const perVersion = page.getByRole("region", { name: "Issues per version" });
  await expect(perVersion.getByRole("listitem").nth(0)).toContainText(
    "v14 issues: High 2, Medium 2, Low 0",
  );
  await expect(perVersion.getByRole("listitem").nth(2)).toContainText("v30 issues");

  await expect(page.getByRole("region", { name: "Where I disagreed" })).toContainText(
    "No reasons yet",
  );

  await expect(page.getByRole("link", { name: "Compare v2 and v3" })).toHaveAttribute(
    "href",
    "/projects/checkout-practice/compare?from=checkout-v2&to=checkout-v3",
  );
  await expect(page.getByRole("link", { name: "Review a new version" })).toHaveAttribute(
    "href",
    "/new?project=checkout-practice",
  );
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Open review of v2" }).click();
  await expect(page).toHaveURL(/\/reviews\/review-checkout-v2$/);
});

test("Where I disagreed quotes the reason, with version, principle and confidence", async ({
  page,
}) => {
  await page.goto("/projects/sign-up-form");
  const disagreed = page.getByRole("region", { name: "Where I disagreed" });
  await expect(disagreed).toContainText("Password rules are not shown");
  await expect(disagreed).toContainText("v1 · Nielsen 5 · Confidence: low");
  await expect(disagreed).toContainText("“The rules appear as soon as the password field");
  // One version: no compare button.
  await expect(page.getByRole("link", { name: /^Compare/ })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("Delete project: Keep project is focused, Escape keeps, delete goes to Projects", async ({
  page,
}) => {
  await page.goto("/projects/sign-up-form");
  const opener = page.getByRole("button", { name: "Delete project" });
  await opener.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("alertdialog", { name: "Delete “Sign up form”?" });
  await expect(dialog).toContainText("1 review and its screenshot");
  await expect(dialog).toContainText("1 reason you wrote when you disagreed");
  await expect(dialog).toContainText("You can't undo this.");
  await expect(dialog.getByRole("button", { name: "Keep project" })).toBeFocused();
  await expectNoAxeViolations(page);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  await page.keyboard.press("Enter");
  await dialog.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("region", { name: "Notifications" }).getByText("Deleted Sign up form"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign up form/ })).toHaveCount(0);
});

test("an unknown project says it was not found", async ({ page }) => {
  await page.goto("/projects/does-not-exist");
  await expect(page.getByRole("heading", { level: 1, name: "Project not found" })).toBeVisible();
});
