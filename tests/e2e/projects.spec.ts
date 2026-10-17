import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

test("Projects shows every sample project, the trend and recent reviews", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

  const checkout = page.getByRole("link", { name: /Checkout practice/ }).first();
  await expect(checkout).toContainText("v3 · reviewed 14 Oct");
  await expect(checkout).toContainText("High 0");
  await expect(checkout).toContainText("2 fewer issues than v2");

  const signUp = page.getByRole("link", { name: /Sign up form/ }).first();
  await expect(signUp).toContainText("First review");
  await expect(signUp).toContainText("High 1");

  await expect(page.getByRole("link", { name: "Add a project" })).toHaveAttribute(
    "href",
    "/new?project=new",
  );

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(6); // header + 5 reviews
  const firstRow = table.getByRole("row").nth(1);
  await expect(firstRow).toContainText("14 Oct");
  await expect(firstRow).toContainText("Checkout practice");
  const signUpRow = table.getByRole("row", { name: /Sign up form/ });
  await expect(signUpRow.getByRole("cell").nth(4)).toHaveText("1");

  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Open review of Sign up form v1" }).click();
  await expect(page).toHaveURL(/\/reviews\/review-signup-v1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Review of v1" })).toBeVisible();
});

test("a project card opens its history", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: /Analytics dashboard/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/projects\/analytics-dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Analytics dashboard" })).toBeVisible();
});

test("First use appears when every project is deleted, and Reset demo brings them back", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "uxc-demo-v1",
      JSON.stringify({
        v: 1,
        pushbacks: {},
        deletedProjectIds: ["checkout-practice", "sign-up-form", "analytics-dashboard"],
        checklist: null,
        created: { projects: [], versions: [], reviews: [] },
      }),
    ),
  );
  await page.reload();

  await expect(
    page.getByRole("heading", { level: 1, name: "Review your first design" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a review" })).toHaveAttribute("href", "/new");
  const steps = page.getByRole("main").getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("Drop a screenshot");
  await expect(steps.nth(2)).toContainText("Push back");
  await expectNoAxeViolations(page);

  await page.getByRole("main").getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Checkout practice/ }).first()).toBeVisible();
});
