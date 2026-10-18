import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../axe";
import { RESULT_TIMEOUT, startReview } from "./upload";

// docs/08 §4 in live mode: no issues (fake-empty), failed (fake-timeout), partial (fake-unreadable).

test("No issues found (fake-empty)", async ({ page }) => {
  await startReview(page, {
    project: "Empty check",
    fileName: "fake-empty.png",
    screenshot: "clean",
  });
  await expect(page.getByRole("heading", { level: 2, name: "No issues found" })).toBeVisible({
    timeout: RESULT_TIMEOUT,
  });
  await expect(
    page.getByText(
      "Checked against Nielsen's heuristics, WCAG 2.2, the Laws of UX and your 6 rules. Evaluated by fake-ai.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to project" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Review failed (fake-timeout): sentence, details, Try again starts a new review", async ({
  page,
}) => {
  const first = await startReview(page, { project: "Slow network", fileName: "fake-timeout.png" });
  const heading = page.getByRole("heading", { level: 1, name: "The review didn't finish" });
  await expect(heading).toBeVisible({ timeout: RESULT_TIMEOUT });
  await expect(heading).toBeFocused();
  await expect(
    page.getByText("Claude didn't answer within 60 seconds.", { exact: false }),
  ).toBeVisible();
  await page.getByText("Technical details").click();
  await expect(page.locator("pre")).toContainText("Step: Evaluating against principles");
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).not.toHaveURL(new RegExp(first));
  await expect(heading).toBeVisible({ timeout: RESULT_TIMEOUT });
  // Both reviews belong to the one version: the stored screenshot is reused.
  await page.getByRole("link", { name: "Slow network" }).click();
  await expect(page.getByRole("region", { name: "Versions" }).getByRole("article")).toHaveCount(1);
});

test("Evaluation unreadable (fake-unreadable): banner and Retry evaluation", async ({ page }) => {
  const id = await startReview(page, { project: "Odd answer", fileName: "fake-unreadable.png" });
  await expect(page.getByText("Measured results are ready.")).toBeVisible({
    timeout: RESULT_TIMEOUT,
  });
  await expect(page.getByText("Evaluation missing")).toBeVisible();
  // Only measured issues: the faint helper text, measured by OCR and pixels.
  const filters = page.getByRole("group", { name: "Filter issues" });
  await expect(filters.getByRole("button", { name: "Measured 1" })).toBeVisible();
  await expect(filters.getByRole("button", { name: "Evaluated 0" })).toBeVisible();
  await expect(page.locator("article").first()).toContainText(
    '"We send your receipt to this address" is too faint',
  );
  // Call 1 came back unreadable too, so target sizes were skipped, and the screen says why.
  await expect(
    page.getByText("Target sizes weren't measured, because finding the controls failed."),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  const retry = page.waitForResponse(
    (r) => r.url().endsWith(`/api/reviews/${id}/retry`) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Retry evaluation" }).click();
  expect((await retry).status()).toBe(200);
  // The same fixture answers again, so the review is partial again, measured issue kept.
  await expect(page.getByText("Measured results are ready.")).toBeVisible({
    timeout: RESULT_TIMEOUT,
  });
  await expect(page.locator("article")).toHaveCount(1);
});

test("Cancel review stops it and returns to a filled in form", async ({ page }) => {
  await startReview(page, { project: "Changed my mind", fileName: "fake-slow.png" });
  await expect(page.getByRole("heading", { level: 1, name: "Reviewing v1…" })).toBeVisible();
  // Measuring (OCR) can queue behind other tests' reviews before evaluation starts.
  await expect(page.getByText("Evaluating against principles, in progress")).toBeAttached({
    timeout: RESULT_TIMEOUT,
  });
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Cancel review" }).click();
  await expect(page).toHaveURL(/\/new\?/);
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue("Changed my mind");
  await expect(page.getByRole("textbox", { name: /What is this screen for/ })).toHaveValue(
    "Coffee checkout",
  );
  // The version and the project made for it are gone.
  const projects = await (await page.request.get("/api/projects")).json();
  expect(projects.map((p: { name: string }) => p.name)).not.toContain("Changed my mind");
});

test("a new version of a project gets the next free name", async ({ page }) => {
  await startReview(page, { project: "Versions", fileName: "fake-empty.png", screenshot: "clean" });
  await expect(page.getByRole("heading", { level: 2, name: "No issues found" })).toBeVisible({
    timeout: RESULT_TIMEOUT,
  });
  await page.goto("/new");
  await page.getByRole("combobox", { name: "Project" }).selectOption({ label: "Versions" });
  await expect(page.getByRole("textbox", { name: "Version name" })).toHaveValue("v2");
});
