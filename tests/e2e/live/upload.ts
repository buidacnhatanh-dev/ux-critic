import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** A real screenshot from the demo; the file name picks the fake AI fixture (docs/03). */
const png = readFileSync("public/demo/checkout-v1.png");

/** Fills the live New review form and starts the review. Lands on /reviews/<id>. */
export async function startReview(
  page: Page,
  { project, fileName, version = "v1" }: { project: string; fileName: string; version?: string },
) {
  await page.goto("/new");
  await expect(page.getByRole("heading", { level: 1, name: "New review" })).toBeVisible();
  await page
    .getByTestId("file-input")
    .setInputFiles({ name: fileName, mimeType: "image/png", buffer: png });
  const select = page.getByRole("combobox", { name: "Project" });
  const existing = await select.locator("option", { hasText: project }).count();
  if (existing) {
    await select.selectOption({ label: project });
  } else {
    await select.selectOption({ label: "New project…" });
    await page.getByRole("textbox", { name: "Project name" }).fill(project);
  }
  await page.getByRole("textbox", { name: "Version name" }).fill(version);
  await page.getByRole("textbox", { name: /What is this screen for/ }).fill("Coffee checkout");
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page).toHaveURL(/\/reviews\/[0-9a-f-]+$/);
  return page.url().split("/").at(-1)!;
}
