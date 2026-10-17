import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../e2e/axe";

// docs/10: production build in demo mode. Open every screen, axe on each.
const SCREENS: [string, string][] = [
  ["/", "Projects"],
  ["/projects/checkout-practice", "Checkout practice"],
  ["/projects/checkout-practice/compare", "What changed"],
  ["/reviews/review-checkout-v1", "Review of v1"],
  ["/reviews/review-checkout-v3", "Review of v3"],
  ["/reviews/review-signup-v1", "Review of v1"],
  ["/new", "New review"],
  ["/checklist", "My checklist"],
  ["/setup", "Connect Claude to start reviewing"],
  ["/states", "Screen states"],
  ["/states/setup", "Connect Claude to start reviewing"],
  ["/states/failed", "The review didn't finish"],
  ["/states/partial", "Review of v1"],
  ["/states/upload", "New review"],
];

for (const [path, heading] of SCREENS) {
  test(`${path} works in the production demo and passes axe`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    const elsewhere: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(baseURL!) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        elsewhere.push(url);
      }
    });

    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByText("Demo", { exact: true })).toBeVisible();
    await expect(nav.getByText("Sample reviews written by hand")).toBeVisible();
    await expectNoAxeViolations(page);
    // CLAUDE.md privacy: no third party requests, and nothing broken.
    expect(elsewhere).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("a demo review runs from New review to the prepared result", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/new?project=new");
  await page.getByRole("radio", { name: "Sign up form" }).check();
  await page.getByRole("textbox", { name: "Project name" }).fill("Smoke test");
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Review of v1" })).toBeVisible();
  await expect(page.getByText(/5 issues · reviewed/)).toBeVisible();
});

test("every API path is 404, with and without a body", async ({ request }) => {
  for (const path of [
    "/api",
    "/api/reviews",
    "/api/reviews/abc",
    "/api/rules",
    "/api/projects/x",
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
    expect((await request.post(path, { data: {} })).status(), path).toBe(404);
  }
});

test("the dev component preview is not in production", async ({ request }) => {
  expect((await request.get("/dev/ui")).status()).toBe(404);
});

test("robots allow crawling and og:image is a captured Review screen", async ({
  page,
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("User-Agent: *");
  expect(robots).toContain("Allow: /");

  await page.goto("/");
  const og = page.locator('meta[property="og:image"]').first();
  const url = await og.getAttribute("content");
  expect(url).toMatch(/opengraph-image/);
  await expect(page.locator('meta[property="og:image:width"]').first()).toHaveAttribute(
    "content",
    "1200",
  );
  await expect(page.locator('meta[property="og:image:height"]').first()).toHaveAttribute(
    "content",
    "630",
  );
  const image = await request.get(new URL(url!).pathname + new URL(url!).search);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});
