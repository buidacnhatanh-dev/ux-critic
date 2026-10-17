import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

test("Compare defaults to the two newest versions", async ({ page }) => {
  await page.goto("/projects/checkout-practice/compare");
  await expect(page.getByRole("heading", { level: 1, name: "What changed" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "From" })).toHaveValue("checkout-v2");
  await expect(page.getByRole("combobox", { name: "To" })).toHaveValue("checkout-v3");
  const tiles = page.getByRole("list", { name: "Summary" });
  await expect(tiles.getByRole("listitem").nth(0)).toHaveText("Fixed2");
  await expect(tiles.getByRole("listitem").nth(1)).toHaveText("Still open0");
  await expect(tiles.getByRole("listitem").nth(2)).toHaveText("New in v30");
  await expect(page.getByText("No new issues in v3.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Compare v1 and v2: fixed with measured values, still open, new with a link", async ({
  page,
}) => {
  await page.goto("/projects/checkout-practice/compare");
  await page.getByRole("combobox", { name: "To" }).selectOption("checkout-v2");
  await page.getByRole("combobox", { name: "From" }).selectOption("checkout-v1");
  await expect(page).toHaveURL(/from=checkout-v1&to=checkout-v2/);

  const tiles = page.getByRole("list", { name: "Summary" });
  await expect(tiles.getByRole("listitem").nth(0)).toHaveText("Fixed3");
  await expect(tiles.getByRole("listitem").nth(1)).toHaveText("Still open1");
  await expect(tiles.getByRole("listitem").nth(2)).toHaveText("New in v21");
  await expect(page.getByText("v1 · 4 issues")).toBeVisible();
  await expect(page.getByText("v2 · 2 issues")).toBeVisible();

  const fixed = page.getByRole("region", { name: "Fixed" });
  await expect(fixed).toContainText("Fields have no visible labels");
  await expect(fixed).toContainText("Evaluated · High · WCAG 3.3.2 Labels or instructions");
  // Values come from the measurements of both reviews; "was" is v1, "now" is v2.
  await expect(fixed).toContainText(/Measured · was 1\.85 : 1, now \d+(\.\d+)? : 1/);
  await expect(fixed).toContainText(
    /Measured · was 10\.5 px, (now \d+(\.\d+)? px|no longer found)/,
  );

  const open = page.getByRole("region", { name: "Still open" });
  await expect(open).toContainText("Five payment options compete");
  await expect(open).toContainText("Evaluated · Medium · Hick's law");

  const severity = page.getByRole("table");
  await expect(severity.getByRole("row", { name: /High/ })).toHaveText("High21");
  await expect(severity.getByRole("row", { name: /Total/ })).toHaveText("Total42");
  await expectNoAxeViolations(page);

  const added = page.getByRole("region", { name: "New in v2" });
  await expect(added).toContainText("Card number error is shown only in red");
  await added.getByRole("link", { name: /Open in v2 review/ }).click();
  await expect(page).toHaveURL(/\/reviews\/review-checkout-v2\?issue=/);
  await expect(page.locator("article#issue-2 h3 button")).toHaveAttribute("aria-expanded", "true");
});

test("Still open shows my reason from the earlier version", async ({ page }) => {
  // Push back on v1 issue 3 (payment options) through the Review screen, then compare.
  await page.goto("/reviews/review-checkout-v1");
  await page.locator("article#issue-3 h3 button").click();
  await page.getByRole("button", { name: "I disagree with issue 3" }).click();
  await page
    .getByRole("textbox", { name: "Why is this not a problem here?" })
    .fill("All five are used.");
  await page.getByRole("button", { name: "Save reason" }).click();
  await expect(page.getByRole("button", { name: /^Undo/ })).toBeVisible();

  await page.goto("/projects/checkout-practice/compare?from=checkout-v1&to=checkout-v2");
  await expect(page.getByRole("region", { name: "Still open" })).toContainText(
    "I disagreed in v1: All five are used.",
  );
});

test("one version cannot be compared", async ({ page }) => {
  await page.goto("/projects/sign-up-form/compare");
  await expect(page.getByText("Comparing needs two reviewed versions")).toBeVisible();
  await expectNoAxeViolations(page);
});
