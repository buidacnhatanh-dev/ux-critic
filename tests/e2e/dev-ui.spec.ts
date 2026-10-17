import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

test.describe("/dev/ui", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/ui");
    await expect(page.getByRole("heading", { level: 1, name: "UI components" })).toBeVisible();
  });

  test("shows every component and passes axe", async ({ page }) => {
    for (const name of [
      "Button",
      "TextField",
      "Textarea",
      "Select",
      "Checkbox",
      "RadioGroup",
      "Pill",
      "Tooltip",
      "Dialog",
      "Toast",
      "Announcer",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
    await expectNoAxeViolations(page);
  });

  test("every focusable element shows the focus ring", async ({ page }) => {
    const missing: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        // Next's dev tools overlay is not part of the app: the walk is done.
        if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
        const style = getComputedStyle(el);
        const index = Array.from(document.querySelectorAll("*")).indexOf(el);
        const key = `${index}:${el.tagName} ${el.textContent?.trim().slice(0, 40) ?? ""}`;
        return { key, shadow: style.boxShadow };
      });
      if (!info) break;
      if (seen.has(info.key)) break;
      seen.add(info.key);
      if (!info.shadow.includes("rgb(255, 194, 26)")) missing.push(info.key);
    }
    expect(seen.size).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });

  test("dialogs move focus in and return it", async ({ page }) => {
    const opener = page.getByRole("button", { name: "Open alert dialog" });
    await opener.click();
    const dialog = page.getByRole("alertdialog", { name: 'Delete "Sample project A"?' });
    await expect(dialog.getByRole("button", { name: "Keep project" })).toBeFocused();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();

    await page.getByRole("button", { name: "Open dialog" }).click();
    await expect(page.getByRole("textbox", { name: "Rule" })).toBeFocused();
    await page.keyboard.press("Escape");
  });

  test("tooltip shows on focus and hides on Escape", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Tooltip on top" });
    await trigger.focus();
    await expect(page.getByRole("tooltip", { name: /Regions are approximate/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("toast with Undo appears bottom left and passes axe", async ({ page }) => {
    await page.getByRole("button", { name: "Show toast with Undo" }).click();
    const region = page.getByRole("region", { name: "Notifications" });
    await expect(region.getByText("Deleted rule")).toBeVisible();
    const box = await region.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeLessThan(40);
    expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 40);
    await expectNoAxeViolations(page);
    await region.getByRole("button", { name: "Undo" }).click();
    await expect(region.getByText("Rule restored")).toBeVisible();
  });
});
