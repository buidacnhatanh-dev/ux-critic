import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

test("No issues found: honest wording, what it was checked against, compare and fixed count", async ({
  page,
}) => {
  await page.goto("/reviews/review-checkout-v3");
  await expect(page.getByRole("heading", { level: 1, name: "Review of v3" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "No issues found" })).toBeVisible();
  await expect(
    page.getByText(
      "Checked against Nielsen's heuristics, WCAG 2.2, the Laws of UX and your 6 rules.",
    ),
  ).toBeVisible();
  await expect(page.getByText("That doesn't mean there are no problems.")).toBeVisible();
  await expect(page.locator("[data-issue-number]")).toHaveCount(0);
  await expect(page.getByText("Fixed since v2: 2 issues.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to project" })).toHaveAttribute(
    "href",
    "/projects/checkout-practice",
  );
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Compare with v2" }).click();
  await expect(page).toHaveURL(/compare\?from=checkout-v2&to=checkout-v3/);
  await expect(page.getByRole("heading", { level: 1, name: "What changed" })).toBeVisible();
});
