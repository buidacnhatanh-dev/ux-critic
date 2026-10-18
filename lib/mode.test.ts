import { hasClaude, resolveMode } from "./mode";

describe("resolveMode", () => {
  it("is demo when UXC_MODE is missing", () => {
    expect(resolveMode({})).toBe("demo");
  });

  it("is demo when UXC_MODE=demo, even with a key", () => {
    expect(resolveMode({ UXC_MODE: "demo", ANTHROPIC_API_KEY: "sk-test" })).toBe("demo");
  });

  it("is live with UXC_MODE=live, with or without a key (no key shows Connect Claude)", () => {
    expect(resolveMode({ UXC_MODE: "live", ANTHROPIC_API_KEY: "sk-test" })).toBe("live");
    expect(resolveMode({ UXC_MODE: "live" })).toBe("live");
    expect(resolveMode({ UXC_MODE: " live " })).toBe("live");
  });

  it("treats unknown values as demo", () => {
    expect(resolveMode({ UXC_MODE: "LIVE", ANTHROPIC_API_KEY: "sk-test" })).toBe("demo");
    expect(resolveMode({ UXC_MODE: "production", ANTHROPIC_API_KEY: "sk-test" })).toBe("demo");
  });
});

describe("hasClaude", () => {
  it("needs a key that is not blank", () => {
    expect(hasClaude({ ANTHROPIC_API_KEY: "sk-test" })).toBe(true);
    expect(hasClaude({ ANTHROPIC_API_KEY: "   " })).toBe(false);
    expect(hasClaude({})).toBe(false);
  });

  it("counts fake AI mode as connected", () => {
    expect(hasClaude({ UXC_FAKE_AI: "1" })).toBe(true);
    expect(hasClaude({ UXC_FAKE_AI: "0" })).toBe(false);
  });
});
