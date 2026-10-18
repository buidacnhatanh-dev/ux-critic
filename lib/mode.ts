import type { Mode } from "./data/types";

export type { Mode };

type ModeEnv = Readonly<Record<string, string | undefined>>;

/**
 * docs/10: UXC_MODE=live turns on live mode. Anything else, including a missing or misspelled
 * UXC_MODE, is demo. Live mode without a key shows Connect Claude (docs/03 "No API key").
 */
export function resolveMode(env: ModeEnv): Mode {
  return env.UXC_MODE?.trim() === "live" ? "live" : "demo";
}

/** Live mode can evaluate: a key, or fake AI mode (UXC_FAKE_AI=1) so tests need no network. */
export function hasClaude(env: ModeEnv): boolean {
  return env.UXC_FAKE_AI?.trim() === "1" || Boolean(env.ANTHROPIC_API_KEY?.trim());
}

/** Server only: reads the environment of the running server. */
export function getMode(): Mode {
  return resolveMode(process.env);
}
