// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import {
  callClaude,
  ClaudeTimeoutError,
  describeError,
  isRetryable,
  modelId,
  timeoutMs,
} from "./claude";

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

describe("callClaude", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns the model from the response, which differs after a fallback", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
    vi.stubEnv("UXC_MODEL", "claude-sonnet-5-5");
    const requests: { model: string; fallbacks: string }[] = [];
    // No network: the SDK's fetch answers like the API after a server-side fallback.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init: { body: string }) => {
        requests.push(JSON.parse(init.body));
        return new Response(
          JSON.stringify({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-opus-4-8",
            content: [{ type: "text", text: '{"issues":[]}' }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 1200, output_tokens: 80 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const answer = await callClaude({
      system: "s",
      content: [{ type: "text", text: "t" }],
      schema: { type: "object" },
      maxTokens: 100,
    });
    expect(requests[0]).toMatchObject({ model: "claude-sonnet-5-5", fallbacks: "default" });
    expect(answer).toEqual({
      text: '{"issues":[]}',
      stopReason: "end_turn",
      usage: { input: 1200, output: 80 },
      model: "claude-opus-4-8",
    });
  });
});
