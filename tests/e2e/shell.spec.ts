import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

// [path, page title, h1]
const ROUTES: [string, string, string][] = [
  ["/", "Projects", "Projects"],
  ["/new", "New review", "New review"],
  ["/checklist", "My checklist", "My checklist"],
  ["/setup", "Connect Claude", "Connect Claude"],
  ["/projects/checkout-practice", "Project history", "Checkout practice"],
  ["/projects/checkout-practice/compare", "Compare versions", "What changed"],
  ["/reviews/review-checkout-v1", "Review", "Review of v1"],
  ["/states", "Screen states", "Screen states"],
];

for (const [path, title, heading] of ROUTES) {
  test(`${path} renders the shell and passes axe`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`${title} · UX Critic`));
    await expectNoAxeViolations(page);
  });
}

test("navigation marks the current page", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "My checklist" }).click();
  await expect(page).toHaveURL(/\/checklist$/);
  await expect(nav.getByRole("link", { name: "My checklist" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
});

test("demo mode shows the Demo pill and where the reviews came from", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByText("Demo", { exact: true })).toBeVisible();
  await expect(nav.getByText("Sample reviews written by hand")).toBeVisible();
  await expect(nav.getByText("Private · runs on this laptop")).toHaveCount(0);
});

test("How this demo works: keyboard open, focus in, Escape closes, focus returns", async ({
  page,
}) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "How this demo works" });
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "How this demo works" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("never calls Claude");
  await expect(dialog.getByRole("button", { name: "Close" }).first()).toBeFocused();
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("How this demo works links to all screen states", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "How this demo works" }).click();
  await page.getByRole("link", { name: "See all screen states" }).click();
  await expect(page).toHaveURL(/\/states$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Reset demo asks once, focuses the safe action, then clears the browser data", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("uxc-demo-v1", '{"pushbacks":{}}'));
  const opener = page.getByRole("button", { name: "Reset demo" });
  await opener.click();
  const dialog = page.getByRole("alertdialog", { name: "Reset the demo?" });
  await expect(dialog.getByRole("button", { name: "Keep my changes" })).toBeFocused();
  await expectNoAxeViolations(page);

  await dialog.getByRole("button", { name: "Keep my changes" }).click();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("uxc-demo-v1"))).not.toBeNull();

  await opener.click();
  await dialog.getByRole("button", { name: "Reset demo" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Demo reset. Your changes in this browser are cleared."),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("uxc-demo-v1"))).toBeNull();
});

test("skip link moves focus to the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("sidebar stacks above the content on narrow windows", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  // Measure once the page has rendered with its styles.
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  const nav = await page.getByRole("navigation", { name: "Main" }).boundingBox();
  const main = await page.locator("main").boundingBox();
  expect(nav && main && main.y >= nav.y + nav.height - 1).toBe(true);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

test("API routes return 404 in demo mode", async ({ request }) => {
  for (const path of ["/api", "/api/reviews", "/api/reviews/x/retry", "/api/projects/x"]) {
    const get = await request.get(path);
    expect(get.status(), path).toBe(404);
  }
  const post = await request.post("/api/reviews", { data: {} });
  expect(post.status()).toBe(404);
});
