import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, tabTo } from "./axe";

const toast = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Notifications" });

test.beforeEach(async ({ page }) => {
  await page.goto("/checklist");
  await expect(page.getByRole("heading", { level: 1, name: "My checklist" })).toBeVisible();
});

test("shows principles, rules, the demo note and connection, and passes axe", async ({ page }) => {
  await expect(
    page.getByText("In the demo, checklist changes apply to new reviews only."),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Nielsen's 10 heuristics" })).toBeChecked();
  await expect(page.getByText("6 rules")).toBeVisible();
  const rules = page.getByRole("region", { name: "My own rules" }).getByRole("listitem");
  await expect(rules).toHaveCount(6);
  await expect(rules.nth(0)).toContainText("Touch targets are at least 44 by 44 px");
  await expect(rules.nth(0)).toContainText("Measured");
  await expect(rules.nth(2)).toContainText("Evaluated");
  await expect(page.getByText("Demo mode · no API key needed")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a principle set saves at once with a toast", async ({ page }) => {
  const laws = page.getByRole("checkbox", { name: "Laws of UX" });
  await laws.uncheck();
  await expect(toast(page).getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Laws of UX" })).not.toBeChecked();
});

test("add a rule: errors on submit, evaluated and measured rules", async ({ page }) => {
  const text = page.getByRole("textbox", { name: "Add a rule" });
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(text).toBeFocused();
  await expect(text).toHaveAttribute("aria-invalid", "true");

  await text.fill("Never more than 2 typefaces");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(toast(page).getByText("Rule added")).toBeVisible();
  await expect(page.getByText("7 rules")).toBeVisible();

  await text.fill("Buttons at least 48 px");
  await page.getByRole("combobox", { name: "Checked by" }).selectOption("measured");
  await page.getByRole("combobox", { name: "What is measured" }).selectOption("target_size_min");
  const threshold = page.getByRole("spinbutton", { name: "Threshold (CSS px)" });
  await threshold.fill("");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(threshold).toBeFocused();
  await threshold.fill("48");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByText("8 rules")).toBeVisible();
  const last = page.getByRole("region", { name: "My own rules" }).getByRole("listitem").last();
  await expect(last).toContainText("Buttons at least 48 px");
  await expect(last).toContainText("Measured");
});

test("Edit a rule with the keyboard: focus in the text, move, save, focus returns", async ({
  page,
}) => {
  const edit = page.getByRole("button", { name: "Edit rule: Every field has a visible label" });
  await tabTo(page, edit);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Edit rule" });
  const text = dialog.getByRole("textbox", { name: "Rule" });
  await expect(text).toBeFocused();
  await expect(dialog.getByRole("radio", { name: "Evaluated" })).toBeChecked();
  await expect(dialog.getByText("Rule 3 of 6")).toBeVisible();
  await expectNoAxeViolations(page);

  // Escape closes without saving.
  await text.fill("Changed but not saved");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(edit).toBeFocused();
  await expect(page.getByText("Changed but not saved")).toHaveCount(0);

  await page.keyboard.press("Enter");
  await text.fill("Every field has a visible label above it");
  await dialog.getByRole("button", { name: "Move up" }).click();
  await expect(dialog.getByText("Rule 2 of 6")).toBeVisible();
  await expect(page.locator('[data-announcer="polite"]')).toHaveText("Moved up. Rule 2 of 6.");

  // Measured shows the metric and threshold.
  await dialog.getByRole("radio", { name: "Measured" }).check();
  await expect(dialog.getByRole("combobox", { name: "What is measured" })).toBeVisible();
  await dialog.getByRole("radio", { name: "Evaluated" }).check();

  await dialog.getByRole("button", { name: "Save rule" }).click();
  await expect(dialog).toBeHidden();
  const rules = page.getByRole("region", { name: "My own rules" }).getByRole("listitem");
  await expect(rules.nth(1)).toContainText("Every field has a visible label above it");
  await expect(
    page.getByRole("button", { name: "Edit rule: Every field has a visible label above it" }),
  ).toBeFocused();
});

test("Delete a rule shows a toast with Undo that puts it back", async ({ page }) => {
  await page.getByRole("button", { name: "Edit rule: One primary button per screen" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit rule" });
  await dialog.getByRole("button", { name: "Delete rule" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("5 rules")).toBeVisible();
  await expect(page.getByRole("heading", { name: "My own rules" })).toBeFocused();
  const notice = toast(page);
  await expect(notice.getByText("Deleted rule: One primary button per screen")).toBeVisible();

  await notice.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("6 rules")).toBeVisible();
  const rules = page.getByRole("region", { name: "My own rules" }).getByRole("listitem");
  await expect(rules.nth(3)).toContainText("One primary button per screen");
  await expect(
    page.getByRole("button", { name: "Edit rule: One primary button per screen" }),
  ).toBeFocused();
});
