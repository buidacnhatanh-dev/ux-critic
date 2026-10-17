import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

test("/states lists the screen states the demo can't reach", async ({ page }) => {
  await page.goto("/states");
  for (const name of [
    "Connect Claude",
    "Review failed",
    "Evaluation unreadable",
    "Upload and form errors",
  ]) {
    await expect(page.getByRole("link", { name })).toBeVisible();
  }
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Review failed" }).click();
  await expect(page).toHaveURL(/\/states\/failed$/);
});

for (const path of ["/setup", "/states/setup"]) {
  test(`Connect Claude on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "Connect Claude to start reviewing" }),
    ).toBeVisible();
    await expect(page.getByText("No API key found")).toBeVisible();
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("ANTHROPIC_API_KEY=your-key-here")).toBeVisible();
    await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Continue with measured checks only" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
}

test("Review failed: heading focused, human message, technical details", async ({ page }) => {
  await page.goto("/states/failed");
  const heading = page.getByRole("heading", { level: 1, name: "The review didn't finish" });
  await expect(heading).toBeFocused();
  await expect(page.getByText("Sample state.")).toBeVisible();
  await expect(
    page.getByText(
      "Claude didn't answer within 60 seconds. This is usually a slow connection or a busy service.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/Your screenshot, context and settings are saved/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Change settings" })).toHaveAttribute(
    "href",
    /\/new\?project=checkout-practice/,
  );
  await page.getByText("Technical details").click();
  await expect(page.getByText(/Step: Evaluating against principles/)).toBeVisible();
  await expect(page.getByText(/Measured checks: finished \(saved\)/)).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page
      .getByRole("region", { name: "Notifications" })
      .getByText(/Sample state: in live mode this starts/),
  ).toBeVisible();
});

test("Evaluation unreadable: measured issues, banner, retry and the missing card", async ({
  page,
}) => {
  await page.goto("/states/partial");
  await expect(page.getByRole("heading", { level: 1, name: "Review of v1" })).toBeVisible();
  await expect(page.getByText("Measured results are ready.")).toBeVisible();
  await expect(page.getByText("Evaluation missing")).toBeVisible();
  const cards = page.locator("article h3 button");
  await expect(cards).toHaveCount(2);
  for (let i = 0; i < 2; i++) await expect(cards.nth(i)).toContainText("Measured");
  await expect(page.getByRole("button", { name: "Evaluated 0" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Retry evaluation" }).click();
  await expect(
    page.getByRole("region", { name: "Notifications" }).getByText(/runs the evaluation again/),
  ).toBeVisible();

  // Push back works on the sample without saving anything.
  await cards.nth(0).click();
  await page.getByRole("button", { name: "I disagree with issue 1" }).click();
  await page
    .getByRole("textbox", { name: "Why is this not a problem here?" })
    .fill("Sample reason");
  await page.getByRole("button", { name: "Save reason" }).click();
  await expect(cards.nth(0)).toContainText("I disagreed");
  expect(await page.evaluate(() => localStorage.getItem("uxc-demo-v1"))).toBeNull();
});
