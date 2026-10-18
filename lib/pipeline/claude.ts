/**
 * The one place that talks to the Claude API (server only, live mode only). Structured answers
 * with output_config.format, a timeout per call, one retry on network errors and 5xx, never on
 * 4xx, and cancel through an AbortSignal (docs/03 "Timeouts and retries").
 */
import Anthropic from "@anthropic-ai/sdk";

export type ClaudeUsage = { input: number; output: number };

export type ClaudeAnswer = {
  /** All text blocks joined. Parsed and validated by the caller. */
  text: string;
  stopReason: string | null;
  usage: ClaudeUsage;
};

export type ClaudeRequest = {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Record<string, unknown>;
  maxTokens: number;
  signal?: AbortSignal;
};

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const DEFAULT_TIMEOUT_MS = 60_000;

export function modelId(): string {
  return process.env.UXC_MODEL?.trim() || DEFAULT_MODEL;
}

export function timeoutMs(): number {
  const value = Number(process.env.UXC_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

/** Claude did not answer within UXC_TIMEOUT_MS. The message names the seconds (docs/06 §10). */
export class ClaudeTimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out: Claude didn't answer within ${Math.round(ms / 1000)} s.`);
    this.name = "ClaudeTimeoutError";
  }
}

/** The owner pressed Cancel review. */
export class ReviewCancelledError extends Error {
  constructor() {
    super("The review was cancelled.");
    this.name = "ReviewCancelledError";
  }
}

/** Network errors and 5xx get one more try; 4xx never (docs/03). Timeouts are not retried. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return false;
  if (error instanceof Anthropic.APIUserAbortError) return false;
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.APIError)
    return typeof error.status === "number" && error.status >= 500;
  return false;
}

/** A short, readable message for Review failed; the error kind is picked from it later. */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "401: the API key was not accepted.";
  if (error instanceof Anthropic.PermissionDeniedError)
    return "403: the API key has no permission.";
  if (error instanceof Anthropic.RateLimitError) return "429: rate limit reached.";
  if (error instanceof Anthropic.APIConnectionError) return `Network error: ${error.message}`;
  if (error instanceof Anthropic.APIError)
    return `${error.status ?? "API"} error: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  // Read on the server only; never sent to the browser.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  return client;
}

async function callOnce(request: ClaudeRequest, ms: number): Promise<ClaudeAnswer> {
  const response = await getClient().beta.messages.create(
    {
      model: modelId(),
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: "user", content: request.content }],
      output_config: { format: { type: "json_schema", schema: request.schema } },
      // A policy decline is retried on Anthropic's recommended fallback model; on a model without
      // fallbacks this changes nothing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { timeout: ms, signal: request.signal },
  );
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  return {
    text,
    stopReason: response.stop_reason,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
  };
}

export async function callClaude(request: ClaudeRequest): Promise<ClaudeAnswer> {
  const ms = timeoutMs();
  for (let attempt = 1; ; attempt++) {
    try {
      return await callOnce(request, ms);
    } catch (error) {
      if (request.signal?.aborted || error instanceof Anthropic.APIUserAbortError) {
        throw new ReviewCancelledError();
      }
      if (error instanceof Anthropic.APIConnectionTimeoutError) throw new ClaudeTimeoutError(ms);
      if (attempt === 1 && isRetryable(error)) continue;
      throw new Error(describeError(error), { cause: error });
    }
  }
}
