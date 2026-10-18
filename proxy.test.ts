import { isApi, needsSetup } from "./proxy";

describe("isApi", () => {
  it("matches every API path (404 in demo mode)", () => {
    expect(isApi("/api")).toBe(true);
    expect(isApi("/api/reviews")).toBe(true);
    expect(isApi("/api/issues/abc/pushback")).toBe(true);
  });

  it("leaves pages and static files alone", () => {
    expect(isApi("/")).toBe(false);
    expect(isApi("/apis")).toBe(false);
    expect(isApi("/demo/checkout-v1.png")).toBe(false);
    expect(isApi("/reviews/api")).toBe(false);
  });
});

describe("needsSetup (live mode)", () => {
  it("sends pages to /setup when no key is set", () => {
    expect(needsSetup("/", false)).toBe(true);
    expect(needsSetup("/new", false)).toBe(true);
    expect(needsSetup("/checklist", false, "0")).toBe(true);
  });

  it("never redirects /setup itself or the sample states", () => {
    expect(needsSetup("/setup", false)).toBe(false);
    expect(needsSetup("/states/failed", false)).toBe(false);
  });

  it("lets everything through with a key, or after measured checks only", () => {
    expect(needsSetup("/", true)).toBe(false);
    expect(needsSetup("/new", false, "1")).toBe(false);
  });
});
