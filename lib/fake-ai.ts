/**
 * UXC_FAKE_AI=1 (docs/03 "Fake AI mode"): Claude calls 1 and 2 answer from these fixtures after
 * 500 ms, with no network. The screenshot's file name picks the fixture: `fake-empty`,
 * `fake-unreadable`, `fake-timeout`, anything else is the normal result. `fake-slow` is the
 * normal result after 8 s, so tests can press Cancel review while it runs. Answers are raw text, so
 * they go through the same parsing and validation as real ones. Sample data for tests only.
 */
import {
  ClaudeTimeoutError,
  ReviewCancelledError,
  timeoutMs,
  type ClaudeAnswer,
} from "./pipeline/claude.ts";

export type FakeFixture = "normal" | "empty" | "unreadable" | "timeout";

export const FAKE_DELAY_MS = 500;
export const FAKE_SLOW_DELAY_MS = 8000;

export function isFakeAi(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.UXC_FAKE_AI?.trim() === "1";
}

export function fixtureFor(fileName: string): FakeFixture {
  const name = fileName.toLowerCase();
  if (name.includes("fake-empty")) return "empty";
  if (name.includes("fake-unreadable")) return "unreadable";
  if (name.includes("fake-timeout")) return "timeout";
  return "normal";
}

/** Waits like a call would, and stops at once on cancel. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ReviewCancelledError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new ReviewCancelledError());
      },
      { once: true },
    );
  });
}

const USAGE = { input: 0, output: 0 };
const UNREADABLE = "I reviewed the screen. Here are my notes: {issues: [the labels are";

type Size = { width: number; height: number };

/** A box at fractions of the image Claude received, in whole pixels. */
function at(size: Size, x: number, y: number, w: number, h: number) {
  return {
    x: Math.round(size.width * x),
    y: Math.round(size.height * y),
    width: Math.round(size.width * w),
    height: Math.round(size.height * h),
  };
}

/** Call 2 answer: three notes for the normal fixture, one of them for the whole screen. */
function evaluation(size: Size) {
  return {
    issues: [
      {
        principle_id: "wcag-3.3.2",
        title: "Field labels disappear while typing",
        detail:
          "The fields use placeholder text as their only label. Once someone starts typing, the label is gone and they have to remember what the field was for.",
        fix: "Put a visible label above each field and keep placeholders for examples only.",
        severity: "high",
        confidence: "high",
        region: at(size, 0.1, 0.3, 0.4, 0.12),
      },
      {
        principle_id: "law-hick",
        title: "Too many choices at once",
        detail:
          "Five options of the same weight sit side by side, so people compare all of them before they can pick one.",
        fix: "Show the two most used options first and put the rest behind “More options”.",
        severity: "medium",
        confidence: "medium",
        region: at(size, 0.1, 0.55, 0.5, 0.1),
      },
      {
        principle_id: "nielsen-8",
        title: "Nothing stands out as the next step",
        detail:
          "Every block has the same visual weight, so the main action does not stand out from the rest of the page.",
        fix: "Make the main action the only filled button and quiet the others.",
        severity: "low",
        confidence: "low",
        region: null,
      },
    ],
  };
}

/** Call 1 answer (used from M6): controls at fixed places on the screen. */
function controls(size: Size) {
  return {
    controls: [
      { role: "button", label: "Continue", ...at(size, 0.1, 0.8, 0.2, 0.06) },
      { role: "link", label: "Terms", ...at(size, 0.1, 0.9, 0.04, 0.015) },
    ],
  };
}

async function answer(
  fileName: string,
  signal: AbortSignal | undefined,
  normal: () => unknown,
  empty: unknown,
): Promise<ClaudeAnswer> {
  await wait(
    fileName.toLowerCase().includes("fake-slow") ? FAKE_SLOW_DELAY_MS : FAKE_DELAY_MS,
    signal,
  );
  switch (fixtureFor(fileName)) {
    case "timeout":
      throw new ClaudeTimeoutError(timeoutMs());
    case "unreadable":
      return { text: UNREADABLE, stopReason: "end_turn", usage: USAGE };
    case "empty":
      return { text: JSON.stringify(empty), stopReason: "end_turn", usage: USAGE };
    case "normal":
      return { text: JSON.stringify(normal()), stopReason: "end_turn", usage: USAGE };
  }
}

export function fakeEvaluate(fileName: string, size: Size, signal?: AbortSignal) {
  return answer(fileName, signal, () => evaluation(size), { issues: [] });
}

export function fakeLocate(fileName: string, size: Size, signal?: AbortSignal) {
  return answer(fileName, signal, () => controls(size), { controls: [] });
}
