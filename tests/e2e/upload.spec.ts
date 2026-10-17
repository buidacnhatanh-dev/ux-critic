import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

// The live upload form, shown on /states/upload in the demo. It validates but never uploads.
const png = readFileSync("public/demo/checkout-v1.png");

test.beforeEach(async ({ page }) => {
  await page.goto("/states/upload");
  await expect(page.getByRole("heading", { level: 1, name: "New review" })).toBeVisible();
});

test("upload form: fields, Scale and Check against", async ({ page }) => {
  await expect(page.getByText("Drop a screenshot or paste it")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose a file" })).toBeVisible();
  const scale = page.getByRole("group", { name: "Scale" });
  await expect(scale.getByRole("radio")).toHaveCount(3);
  await expect(scale).toContainText("2× for Retina screenshots");
  const sources = page.getByRole("group", { name: "Check against" });
  await expect(sources.getByRole("checkbox")).toHaveCount(4);
  await expect(sources.getByRole("checkbox", { name: "WCAG 2.2" })).toBeChecked();
  await expect(sources.getByRole("link", { name: "Edit my checklist" })).toHaveAttribute(
    "href",
    "/checklist",
  );
  await expect(sources).toContainText("6 rules");
  await expectNoAxeViolations(page);
});

test("Form errors: wrong type and duplicate version, summary focused, links move focus", async ({
  page,
}) => {
  await page.getByTestId("file-input").setInputFiles({
    name: "checkout-v2.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(page.getByText("checkout-v2.pdf").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose a different file" })).toBeVisible();
  // No error while choosing; only on submit.
  await expect(page.getByText(/This file is a PDF/)).toHaveCount(0);

  await page.getByRole("combobox", { name: "Project" }).selectOption("checkout-practice");
  await page.getByRole("textbox", { name: "Version name" }).fill("v2");
  await page.getByRole("button", { name: "Start review" }).click();

  const summary = page.getByRole("alert").filter({ hasText: "need fixing" });
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("heading")).toHaveText("Two things need fixing");
  await expect(summary.getByRole("link")).toHaveText([
    "The file is a PDF. Use a PNG, JPG or WebP image.",
    '"v2" already exists in this project. Try "v4".',
  ]);
  await expect(
    page.getByText(
      "This file is a PDF. Export the screen as a PNG, JPG or WebP image, or take a screenshot of it.",
    ),
  ).toBeVisible();
  const chooser = page.getByRole("button", { name: "Choose a different file" });
  await expect(chooser).toHaveAccessibleDescription(/This file is a PDF/);
  await expectNoAxeViolations(page);

  await summary.getByRole("link", { name: /The file is a PDF/ }).click();
  await expect(chooser).toBeFocused();
  await summary.getByRole("link", { name: /already exists/ }).click();
  await expect(page.getByRole("textbox", { name: "Version name" })).toBeFocused();
});

test("a file over 20 MB is refused with its size", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(21 * 1024 * 1024),
  });
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(
    page.getByRole("link", { name: "The file is 21.0 MB. Use one up to 20 MB." }),
  ).toBeVisible();
});

test("a PNG shows its thumbnail, suggests 2×, can be removed, and the form passes", async ({
  page,
}) => {
  await page.getByRole("radio", { name: "1×" }).check();
  await page.getByRole("radio", { name: "2×" }).check();
  await page.getByTestId("file-input").setInputFiles({
    name: "checkout-v1.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByText("checkout-v1.png").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove checkout-v1.png" }).click();
  await expect(page.getByRole("button", { name: "Choose a file" })).toBeFocused();

  // Paste from the clipboard anywhere on the page.
  await page.evaluate(async () => {
    const blob = await (await fetch("/demo/signup.png")).blob();
    const data = new DataTransfer();
    data.items.add(new File([blob], "pasted.png", { type: "image/png" }));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
  });
  await expect(page.getByText("pasted.png").first()).toBeVisible();
  await expect(page.getByRole("radio", { name: "2×" })).toBeChecked();

  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByText(/Everything is filled in/)).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "need fixing" })).toHaveCount(0);
});

test("1× is suggested for a narrow screenshot", async ({ page }) => {
  const narrow = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 800;
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByTestId("file-input").setInputFiles({
    name: "narrow.png",
    mimeType: "image/png",
    buffer: Buffer.from(narrow),
  });
  await expect(page.getByRole("radio", { name: "1×" })).toBeChecked();
});
