import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

test.describe("New review in demo mode", () => {
  test("errors show on submit in a focused summary, link to fields and follow fixes", async ({
    page,
  }) => {
    await page.goto("/new");
    await expect(page.getByRole("heading", { level: 1, name: "New review" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Pick a sample screen" })).toBeVisible();
    await expect(page.getByText("In the demo, reviews are prepared in advance.")).toBeVisible();
    // Demo: no upload, no Scale.
    await expect(page.getByRole("button", { name: "Choose a file" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Scale" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue("checkout-practice");
    await expect(page.getByRole("textbox", { name: "Version name" })).toHaveValue("v4");
    await expectNoAxeViolations(page);

    // Nothing shows while typing for the first time.
    const version = page.getByRole("textbox", { name: "Version name" });
    await version.fill("v2");
    await expect(page.getByRole("alert").filter({ hasText: "fixing" })).toHaveCount(0);

    await page.getByRole("button", { name: "Start review" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "things need fixing" });
    await expect(summary.getByRole("heading", { name: "Two things need fixing" })).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveText([
      "Pick a sample screen.",
      '"v2" already exists in this project. Try "v4".',
    ]);
    await expect(version).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText('"v2" already exists. Try "v4".')).toBeVisible();
    await expectNoAxeViolations(page);

    await summary.getByRole("link", { name: /already exists/ }).click();
    await expect(version).toBeFocused();
    await summary.getByRole("link", { name: "Pick a sample screen." }).click();
    await expect(page.getByRole("radio", { name: "Checkout, first draft" })).toBeFocused();

    // Fixing a field updates the summary.
    await version.fill("v4");
    await expect(page.getByRole("heading", { name: "One thing needs fixing" })).toBeVisible();
    await expect(version).not.toHaveAttribute("aria-invalid");
  });

  test("a new project needs a name that is not taken", async ({ page }) => {
    await page.goto("/new?project=new");
    await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue("__new");
    await expect(page.getByRole("textbox", { name: "Version name" })).toHaveValue("v1");
    await page.getByRole("radio", { name: "Sign up form" }).check();
    await page.getByRole("button", { name: "Start review" }).click();
    await expect(page.getByRole("link", { name: "Give the new project a name." })).toBeVisible();
    const name = page.getByRole("textbox", { name: "Project name" });
    await name.fill("checkout practice");
    await expect(
      page.getByRole("link", { name: 'A project called "checkout practice" already exists.' }),
    ).toBeVisible();
  });

  test("Start review shows the simulated steps, then the prepared review", async ({ page }) => {
    await page.goto("/new?project=new");
    await page.getByRole("radio", { name: "Sign up form" }).check();
    await page.getByRole("textbox", { name: "Project name" }).fill("Rally trial");
    await page
      .getByRole("textbox", { name: /What is this screen for/ })
      .fill("Free trial sign up.");
    await page.getByRole("button", { name: "Start review" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Reviewing v1…" })).toBeVisible();
    const steps = page
      .getByRole("listitem")
      .filter({ hasText: /Screenshot loaded|Measured contrast|Evaluating|Placing notes/ });
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(0)).toContainText("2560 × 1600 px");
    await expect(steps.nth(2)).toContainText("Nielsen, WCAG, Laws of UX and my 6 rules");
    await expect(page.getByRole("button", { name: "Cancel review" })).toBeVisible();
    await expectNoAxeViolations(page);

    // Measuring finishes before the evaluation, with its count.
    await expect(steps.nth(1)).toContainText(/\d+ problems? found by measuring/, { timeout: 5000 });
    await expect(page.locator('[data-announcer="polite"]')).toContainText(
      /Now (measuring|evaluating|placing)/,
    );

    await expect(page.getByRole("heading", { level: 1, name: "Review of v1" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/5 issues · reviewed/)).toBeVisible();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText(
      "Review finished. 5 issues found.",
    );

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Rally trial/ }).first()).toContainText(
      "First review",
    );
  });

  test("with reduced motion the prepared review shows at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/new?project=checkout-practice");
    await page.getByRole("radio", { name: "Checkout, final" }).check();
    await page.getByRole("button", { name: "Start review" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Review of v4" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No issues found" })).toBeVisible();
  });

  test("Cancel review goes back to the form, filled in, and removes the version", async ({
    page,
  }) => {
    await page.goto("/new?project=new");
    await page.getByRole("radio", { name: "Analytics dashboard" }).check();
    await page.getByRole("textbox", { name: "Project name" }).fill("Waypoint");
    await page.getByRole("textbox", { name: "Version name" }).fill("v7");
    await page.getByRole("button", { name: "Start review" }).click();
    const cancel = page.getByRole("button", { name: "Cancel review" });
    await cancel.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/new\?/);
    await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue("__new");
    await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue("Waypoint");
    await expect(page.getByRole("textbox", { name: "Version name" })).toHaveValue("v7");
    await expect(page.getByRole("radio", { name: "Analytics dashboard" })).toBeChecked();
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Waypoint/ })).toHaveCount(0);
  });

  test("Review a new version preselects the project", async ({ page }) => {
    await page.goto("/projects/sign-up-form");
    await page.getByRole("link", { name: "Review a new version" }).click();
    await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue("sign-up-form");
    await expect(page.getByRole("textbox", { name: "Version name" })).toHaveValue("v2");
  });
});
