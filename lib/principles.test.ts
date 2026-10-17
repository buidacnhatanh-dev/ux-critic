import { PRINCIPLES, principleName, principleShortName } from "./principles";

describe("principles", () => {
  it("has the 28 principles from docs/05 with unique ids", () => {
    expect(PRINCIPLES).toHaveLength(28);
    expect(new Set(PRINCIPLES.map((p) => p.id)).size).toBe(28);
  });

  it("names principles for Based on", () => {
    expect(principleName("wcag-1.4.3")).toBe("WCAG 1.4.3 Contrast");
    expect(principleName("nielsen-6")).toBe("Nielsen 6: Recognition rather than recall");
    expect(principleName("law-hick")).toBe("Hick's law");
    expect(principleShortName("nielsen-1")).toBe("Nielsen 1");
  });

  it("names own rules from the checklist", () => {
    const rules = new Map([["abc", "One primary button per screen"]]);
    expect(principleName("rule:abc", rules)).toBe("My rule: One primary button per screen");
    expect(principleName("rule:gone", rules)).toBe("My rule (deleted since)");
    expect(principleName("rule:abc", { abc: "Text" })).toBe("My rule: Text");
  });
});
