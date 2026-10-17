import { resolveMode } from "./mode";

describe("resolveMode", () => {
  it("is demo when UXC_MODE is missing", () => {
    expect(resolveMode({})).toBe("demo");
  });

  it("is demo when UXC_MODE=demo, even with a key", () => {
    expect(resolveMode({ UXC_MODE: "demo", ANTHROPIC_API_KEY: "sk-test" })).toBe("demo");
  });

  it("falls back to demo when UXC_MODE=live has no key", () => {
    expect(resolveMode({ UXC_MODE: "live" })).toBe("demo");
    expect(resolveMode({ UXC_MODE: "live", ANTHROPIC_API_KEY: "   " })).toBe("demo");
  });

  it("is live with UXC_MODE=live and a key", () => {
    expect(resolveMode({ UXC_MODE: "live", ANTHROPIC_API_KEY: "sk-test" })).toBe("live");
  });

  it("is live with UXC_MODE=live in fake AI mode", () => {
    expect(resolveMode({ UXC_MODE: "live", UXC_FAKE_AI: "1" })).toBe("live");
    expect(resolveMode({ UXC_MODE: "live", UXC_FAKE_AI: "0" })).toBe("demo");
  });

  it("treats unknown values as demo", () => {
    expect(resolveMode({ UXC_MODE: "LIVE", ANTHROPIC_API_KEY: "sk-test" })).toBe("demo");
    expect(resolveMode({ UXC_MODE: "production", ANTHROPIC_API_KEY: "sk-test" })).toBe("demo");
  });
});
