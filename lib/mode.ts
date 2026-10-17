import type { Mode } from "./data/types";

export type { Mode };

type ModeEnv = Readonly<Record<string, string | undefined>>;

/**
 * docs/10: live mode needs UXC_MODE=live and an API key. Without a key, live falls back to demo.
 * Fake AI mode (UXC_FAKE_AI=1) counts as a key so live flows can be tested without network.
 * Anything else, including a missing or misspelled UXC_MODE, is demo.
 */
export function resolveMode(env: ModeEnv): Mode {
  if (env.UXC_MODE?.trim() !== "live") return "demo";
  const hasKey = Boolean(env.ANTHROPIC_API_KEY?.trim());
  const fakeAi = env.UXC_FAKE_AI?.trim() === "1";
  return hasKey || fakeAi ? "live" : "demo";
}

/** Server only: reads the environment of the running server. */
export function getMode(): Mode {
  return resolveMode(process.env);
}
