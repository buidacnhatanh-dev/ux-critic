// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeTimeoutError, describeError, isRetryable, modelId, timeoutMs } from "./claude";

const apiError = (status: number) =>
  Anthropic.APIError.generate(status, { error: { message: "x" } }, "x", new Headers());

describe("retry policy (docs/03)", () => {
  it("retries network errors and 5xx once", () => {
    expect(isRetryable(new Anthropic.APIConnectionError({ message: "socket hang up" }))).toBe(true);
    expect(isRetryable(apiError(500))).toBe(true);
    expect(isRetryable(apiError(529))).toBe(true);
  });

  it("never retries 4xx, timeouts or a cancel", () => {
    expect(isRetryable(apiError(400))).toBe(false);
    expect(isRetryable(apiError(401))).toBe(false);
    expect(isRetryable(apiError(429))).toBe(false);
    expect(isRetryable(new Anthropic.APIConnectionTimeoutError())).toBe(false);
    expect(isRetryable(new Anthropic.APIUserAbortError())).toBe(false);
    expect(isRetryable(new Error("other"))).toBe(false);
  });
});

describe("messages", () => {
  it("names the error type so Review failed can pick its sentence", () => {
    expect(describeError(apiError(401))).toMatch(/^401/);
    expect(describeError(apiError(429))).toMatch(/^429/);
    expect(describeError(new Anthropic.APIConnectionError({ message: "offline" }))).toMatch(
      /^Network error/,
    );
    expect(new ClaudeTimeoutError(60_000).message).toBe(
      "Timed out: Claude didn't answer within 60 s.",
    );
  });
});

describe("settings", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads the model and timeout from the environment, with defaults", () => {
    vi.stubEnv("UXC_MODEL", "");
    vi.stubEnv("UXC_TIMEOUT_MS", "");
    expect(modelId()).toBe("claude-sonnet-5-5");
    expect(timeoutMs()).toBe(60_000);
    vi.stubEnv("UXC_MODEL", "claude-opus-5-5");
    vi.stubEnv("UXC_TIMEOUT_MS", "1500");
    expect(modelId()).toBe("claude-opus-5-5");
    expect(timeoutMs()).toBe(1500);
  });
});
