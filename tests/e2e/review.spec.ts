import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, tabTo } from "./axe";

// Keyboard only: every interaction below uses Tab, Shift+Tab, Enter and typing.

const card = (page: Page, number: number) => page.locator(`article#issue-${number}`);
const cardHeader = (page: Page, number: number) => card(page, number).getByRole("button").first();
const region = (page: Page, number: number) => page.locator(`[data-issue-number="${number}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto("/reviews/review-checkout-v1");
  await expect(page.getByRole("heading", { level: 1, name: "Review of v1" })).toBeVisible();
});

test("shows the summary, the filters, the caption and cards in number order", async ({ page }) => {
  await expect(page.getByText("4 issues · reviewed 3 Oct")).toBeVisible();
  const filters = page.getByRole("group", { name: "Filter issues" });
  await expect(filters.getByRole("button", { name: "All 4" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(filters.getByRole("button", { name: "Measured 2" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(filters.getByRole("button", { name: "Evaluated 2" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compare with v2" })).toHaveAttribute(
    "href",
    "/projects/checkout-practice/compare?from=checkout-v1&to=checkout-v2",
  );
  await expect(
    page.getByText("Highlighted areas are approximate. Select an issue to see where it is."),
  ).toBeVisible();

  const headers = page.locator("article h3 button");
  await expect(headers).toHaveCount(4);
  await expect(headers.nth(0)).toContainText("Fields have no visible labels");
  await expect(headers.nth(0)).toContainText("Evaluated");
  await expect(headers.nth(0)).toContainText("Based on WCAG 3.3.2 Labels or instructions");
  await expect(headers.nth(1)).toContainText("Measured");
  for (let i = 0; i < 4; i++)
    await expect(headers.nth(i)).toHaveAttribute("aria-expanded", "false");
  await expectNoAxeViolations(page);
});

test("region badge selects its card, and the card selects its region", async ({ page }) => {
  const badge = page.getByRole("button", {
    name: 'Issue 2: "We send your receipt to this address" is too faint',
    exact: true,
  });
  await tabTo(page, badge);
  await page.keyboard.press("Enter");

  // Focus moves to the card, which opens; the region is highlighted.
  await expect(cardHeader(page, 2)).toBeFocused();
  await expect(cardHeader(page, 2)).toHaveAttribute("aria-expanded", "true");
  await expect(region(page, 2)).toHaveAttribute("data-selected", "true");
  await expect(card(page, 2)).toContainText("Measured from pixels");
  await expect(card(page, 2)).toContainText("Suggested fix");
  await expectNoAxeViolations(page);

  // Selecting another card closes the first and moves the highlight.
  await tabTo(page, cardHeader(page, 3));
  await page.keyboard.press("Enter");
  await expect(cardHeader(page, 3)).toHaveAttribute("aria-expanded", "true");
  await expect(cardHeader(page, 2)).toHaveAttribute("aria-expanded", "false");
  await expect(region(page, 3)).toHaveAttribute("data-selected", "true");
  await expect(region(page, 2)).not.toHaveAttribute("data-selected", "true");
  await expect(card(page, 3)).toContainText("Confidence: medium");

  // Enter again closes it.
  await page.keyboard.press("Enter");
  await expect(cardHeader(page, 3)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-selected]")).toHaveCount(0);
});

test("filters show only measured or evaluated issues, cards and regions", async ({ page }) => {
  const filters = page.getByRole("group", { name: "Filter issues" });
  const measured = filters.getByRole("button", { name: "Measured 2" });
  await tabTo(page, measured);
  await page.keyboard.press("Enter");
  await expect(measured).toHaveAttribute("aria-pressed", "true");
  await expect(filters.getByRole("button", { name: "All 4" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("article h3 button")).toHaveCount(2);
  await expect(card(page, 2)).toBeVisible();
  await expect(card(page, 4)).toBeVisible();
  await expect(card(page, 1)).toHaveCount(0);
  await expect(page.locator("[data-issue-number]")).toHaveCount(2);

  const evaluated = filters.getByRole("button", { name: "Evaluated 2" });
  await tabTo(page, evaluated);
  await page.keyboard.press("Enter");
  await expect(page.locator("article h3 button")).toHaveCount(2);
  await expect(card(page, 1)).toBeVisible();
  await expect(card(page, 3)).toBeVisible();
  await expectNoAxeViolations(page);

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(filters.getByRole("button", { name: "All 4" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("article h3 button")).toHaveCount(4);
});

test("push back: reason required, saved with I disagreed, kept after reload, undo", async ({
  page,
}) => {
  await tabTo(page, cardHeader(page, 3));
  await page.keyboard.press("Enter");
  const disagree = card(page, 3).getByRole("button", { name: "I disagree with issue 3" });
  await tabTo(page, disagree);
  await page.keyboard.press("Enter");

  const reason = card(page, 3).getByRole("textbox", { name: "Why is this not a problem here?" });
  await expect(reason).toBeFocused();

  // Saving without a reason shows the error on submit and keeps focus in the field.
  await page.keyboard.press("Tab"); // Cancel
  await page.keyboard.press("Tab"); // Save reason
  await expect(card(page, 3).getByRole("button", { name: "Save reason" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(reason).toBeFocused();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(card(page, 3)).toContainText("Write why this is not a problem here, then save.");
  await expectNoAxeViolations(page);

  // Cancel returns to I disagree.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(disagree).toBeFocused();
  await page.keyboard.press("Enter");

  await page.keyboard.type("Coffee buyers here really do use all five options.");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  const undo = card(page, 3).getByRole("button", { name: "Undo my reason for issue 3" });
  await expect(undo).toBeFocused();
  await expect(card(page, 3)).toContainText("Why I disagree");
  await expect(card(page, 3)).toContainText("Coffee buyers here really do use all five options.");
  await expect(cardHeader(page, 3)).toContainText("I disagreed");
  await expect(page.getByText("4 issues · 1 I disagreed with · reviewed 3 Oct")).toBeVisible();
  await expect(page.locator('[data-announcer="polite"]')).toHaveText(
    "Reason saved. Issue 3 is marked I disagreed.",
  );
  await expectNoAxeViolations(page);

  // Saved in this browser.
  await page.reload();
  await expect(cardHeader(page, 3)).toContainText("I disagreed");
  await tabTo(page, cardHeader(page, 3));
  await page.keyboard.press("Enter");
  await tabTo(page, undo);
  await page.keyboard.press("Enter");
  await expect(disagree).toBeFocused();
  await expect(cardHeader(page, 3)).not.toContainText("I disagreed");
  await expect(page.getByText("4 issues · reviewed 3 Oct")).toBeVisible();
});

test("a prepared push back shows I disagreed and can be undone", async ({ page }) => {
  await page.goto("/reviews/review-signup-v1");
  await expect(page.getByText("5 issues · 1 I disagreed with · reviewed 9 Oct")).toBeVisible();
  const badge = page.getByRole("button", {
    name: "Issue 3: Password rules are not shown",
    exact: true,
  });
  await tabTo(page, badge);
  await page.keyboard.press("Enter");
  await expect(cardHeader(page, 3)).toContainText("I disagreed");
  await expect(card(page, 3)).toContainText("The rules appear as soon as the password field");
  await expect(card(page, 3)).toContainText("Confidence: low");
  await expect(cardHeader(page, 3)).toContainText("Based on Nielsen 5: Error prevention");
  await expect(card(page, 5)).toContainText("Based on My rule: One primary button per screen");
  await expectNoAxeViolations(page);

  await tabTo(page, card(page, 3).getByRole("button", { name: /^Undo/ }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("5 issues · reviewed 9 Oct")).toBeVisible();
});

test("two checks on the same text line keep both badges reachable", async ({ page }) => {
  await page.goto("/reviews/review-dashboard-v1");
  const five = page.getByRole("button", { name: "Issue 5: Text is too faint", exact: true });
  const six = page.getByRole("button", { name: "Issue 6: Body text is small", exact: true });
  const [a, b] = [await five.boundingBox(), await six.boundingBox()];
  expect(a && b && b.x - a.x).toBeGreaterThanOrEqual(24);
  await tabTo(page, six);
  await page.keyboard.press("Enter");
  await expect(cardHeader(page, 6)).toBeFocused();
  await expect(cardHeader(page, 6)).toContainText("Based on My rule: Body text is at least 16 px");
  await expectNoAxeViolations(page);
});

test("an unknown review says it was not found", async ({ page }) => {
  await page.goto("/reviews/nope");
  await expect(page.getByRole("heading", { level: 1, name: "Review not found" })).toBeVisible();
});
