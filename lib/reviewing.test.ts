import { errorKind, errorSentence, sourcesSummary, stepState } from "./reviewing";

describe("reviewing wording", () => {
  it("knows which steps are done, current and waiting", () => {
    expect(stepState("prepare", "evaluate", false)).toBe("done");
    expect(stepState("evaluate", "evaluate", false)).toBe("current");
    expect(stepState("place", "evaluate", false)).toBe("waiting");
    expect(stepState("place", "place", true)).toBe("done");
  });

  it("summarises the sources (docs/05)", () => {
    const all = { nielsen: true, wcag: true, laws: true, mine: true };
    expect(sourcesSummary(all, 6)).toBe("Nielsen, WCAG, Laws of UX and my 6 rules");
    expect(sourcesSummary({ ...all, laws: false, mine: false }, 6)).toBe("Nielsen and WCAG");
    expect(sourcesSummary({ ...all, nielsen: false, wcag: false, laws: false }, 1)).toBe(
      "my 1 rule",
    );
  });

  it("picks the error type and a human sentence", () => {
    expect(errorKind("Request timed out after 60 s")).toBe("timeout");
    expect(errorSentence("Request timed out after 60 s")).toBe(
      "Claude didn't answer within 60 seconds. This is usually a slow connection or a busy service.",
    );
    expect(errorSentence("timeout")).toContain("didn't answer in time");
    expect(errorKind("401 invalid x-api-key")).toBe("key");
    expect(errorKind("429 rate_limit_error")).toBe("rate");
    expect(errorKind("fetch failed: ECONNRESET")).toBe("network");
    expect(errorKind("Something odd")).toBe("unknown");
  });
});
