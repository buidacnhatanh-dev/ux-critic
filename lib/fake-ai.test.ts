// @vitest-environment node
import { fakeEvaluate, fakeLocate, fixtureFor } from "./fake-ai";
import { parseEvaluation } from "./pipeline/evaluate";
import { ClaudeTimeoutError, ReviewCancelledError } from "./pipeline/claude";

const size = { width: 1280, height: 800 };

describe("fake AI fixtures", () => {
  it("picks the fixture by file name", () => {
    expect(fixtureFor("Fake-Empty.png")).toBe("empty");
    expect(fixtureFor("checkout-fake-unreadable.jpg")).toBe("unreadable");
    expect(fixtureFor("fake-timeout.webp")).toBe("timeout");
    expect(fixtureFor("checkout.png")).toBe("normal");
  });

  it("answers the normal result as valid JSON with boxes inside the image", async () => {
    const answer = await fakeEvaluate("checkout.png", size);
    const parsed = parseEvaluation(answer.text, {
      allowedIds: ["wcag-3.3.2", "law-hick", "nielsen-8"],
      size,
    });
    expect(parsed.issues).toHaveLength(3);
    expect(parsed.dropped).toBe(0);
    expect(parsed.issues.filter((i) => i.region === null)).toHaveLength(1);
  });

  it("answers empty, unreadable and timeout", async () => {
    expect(JSON.parse((await fakeEvaluate("fake-empty.png", size)).text)).toEqual({ issues: [] });
    expect(() => JSON.parse(fakeEvaluateText)).toThrow();
    await expect(fakeEvaluate("fake-timeout.png", size)).rejects.toBeInstanceOf(ClaudeTimeoutError);
    expect(JSON.parse((await fakeLocate("checkout.png", size)).text).controls).toHaveLength(2);
  });

  it("is slow only for call 2 with fake-slow", async () => {
    vi.useFakeTimers();
    try {
      let located = false;
      void fakeLocate("fake-slow.png", size).then(() => (located = true));
      await vi.advanceTimersByTimeAsync(600);
      expect(located).toBe(true);
      let evaluated = false;
      void fakeEvaluate("fake-slow.png", size).then(() => (evaluated = true));
      await vi.advanceTimersByTimeAsync(600);
      expect(evaluated).toBe(false);
      await vi.advanceTimersByTimeAsync(8000);
      expect(evaluated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops at once on cancel", async () => {
    const controller = new AbortController();
    const pending = fakeEvaluate("checkout.png", size, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(ReviewCancelledError);
  });
});

let fakeEvaluateText = "";
beforeAll(async () => {
  fakeEvaluateText = (await fakeEvaluate("fake-unreadable.png", size)).text;
});
