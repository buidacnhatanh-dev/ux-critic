import handwritten from "../../demo/handwritten.json";
import { SEED_RULES } from "../db/seed";
import { RULE_KEYS, toCasePrincipleId } from "./rule-keys";

describe("rule keys", () => {
  it("has a key for every seed rule, the same as the demo uses", () => {
    for (const rule of SEED_RULES) expect(RULE_KEYS[rule.text]).toBeDefined();
    for (const rule of handwritten.rules) expect(RULE_KEYS[rule.text]).toBe(rule.key);
  });

  it("turns a seed rule id into its key and leaves the rest alone", () => {
    const rules = [
      { id: "abc", text: "Body text is at least 16 px" },
      { id: "own", text: "Prices include tax" },
    ];
    expect(toCasePrincipleId("rule:abc", rules)).toBe("rule:body-text-16");
    expect(toCasePrincipleId("rule:own", rules)).toBe("rule:own");
    expect(toCasePrincipleId("wcag-1.4.3", rules)).toBe("wcag-1.4.3");
  });
});
