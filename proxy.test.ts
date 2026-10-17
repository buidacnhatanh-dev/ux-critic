import { isBlockedInDemo } from "./proxy";

describe("isBlockedInDemo", () => {
  it("blocks every API path", () => {
    expect(isBlockedInDemo("/api")).toBe(true);
    expect(isBlockedInDemo("/api/reviews")).toBe(true);
    expect(isBlockedInDemo("/api/issues/abc/pushback")).toBe(true);
  });

  it("leaves pages and static files alone", () => {
    expect(isBlockedInDemo("/")).toBe(false);
    expect(isBlockedInDemo("/apis")).toBe(false);
    expect(isBlockedInDemo("/demo/checkout-v1.png")).toBe(false);
    expect(isBlockedInDemo("/reviews/api")).toBe(false);
  });
});
