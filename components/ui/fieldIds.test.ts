import { describedBy } from "./fieldIds";

describe("describedBy", () => {
  it("joins ids and skips missing ones", () => {
    expect(describedBy("a-error", "a-hint")).toBe("a-error a-hint");
    expect(describedBy(undefined, "a-hint")).toBe("a-hint");
    expect(describedBy(undefined, undefined)).toBeUndefined();
  });
});
