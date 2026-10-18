import type { Rule } from "../data/types";
import {
  clampToImage,
  enabledPrinciples,
  EvaluationUnreadableError,
  MAX_EVALUATED_ISSUES,
  outputSchema,
  parseEvaluation,
  systemPrompt,
  trimWords,
  userText,
} from "./evaluate";

const size = { width: 1280, height: 800 };
const allowedIds = ["wcag-3.3.2", "law-hick", "nielsen-8", "rule:r3"];

function note(overrides: Record<string, unknown> = {}) {
  return {
    principle_id: "wcag-3.3.2",
    title: "Labels disappear while typing",
    detail: "Placeholder text is the only label.",
    fix: "Add a visible label above each field.",
    severity: "high",
    confidence: "high",
    region: { x: 100, y: 200, width: 300, height: 40 },
    ...overrides,
  };
}

const answer = (...issues: unknown[]) => JSON.stringify({ issues });

const rule = (id: string, kind: Rule["kind"], enabled = true): Rule => ({
  id,
  text: `Rule ${id}`,
  kind,
  metric: kind === "measured" ? "target_size_min" : null,
  threshold: kind === "measured" ? 44 : null,
  position: 1,
  enabled,
});

describe("prompt", () => {
  it("lists only enabled sets and enabled evaluated rules", () => {
    const list = enabledPrinciples({ nielsen: false, wcag: true, laws: false, mine: true }, [
      rule("r1", "measured"),
      rule("r2", "evaluated", false),
      rule("r3", "evaluated"),
    ]);
    const ids = list.map((p) => p.id);
    expect(ids.every((id) => id.startsWith("wcag-") || id.startsWith("rule:"))).toBe(true);
    expect(ids).toContain("wcag-3.3.2");
    expect(ids).toContain("rule:r3");
    expect(ids).not.toContain("rule:r1");
    expect(ids).not.toContain("rule:r2");
    expect(list.find((p) => p.id === "rule:r3")!.line).toBe("rule:r3: Rule r3");
  });

  it("leaves own rules out when My checklist is off", () => {
    const list = enabledPrinciples({ nielsen: true, wcag: false, laws: false, mine: false }, [
      rule("r3", "evaluated"),
    ]);
    expect(list.map((p) => p.id)).toEqual(Array.from({ length: 10 }, (_, i) => `nielsen-${i + 1}`));
  });

  it("builds the system prompt from the enabled principles", () => {
    const prompt = systemPrompt([{ id: "law-hick", line: "law-hick: Hick's law: More choices" }]);
    expect(prompt).toContain("law-hick: Hick's law: More choices");
    expect(prompt).toContain("At most 8 notes.");
    expect(prompt).not.toContain("nielsen-1");
  });

  it("says when context is missing and lists failing measurements", () => {
    expect(userText("  ", [])).toBe(
      "What this screen is for: Not given\nAlready measured (do not repeat):\nNothing",
    );
    expect(
      userText("Checkout", [{ kind: "contrast", label: "Terms", value: 2.1, threshold: 4.5 }]),
    ).toContain('contrast, "Terms", 2.1, 4.5');
  });

  it("puts the enabled ids into the schema enum", () => {
    const schema = outputSchema(["law-hick"]) as {
      properties: { issues: { items: { properties: { principle_id: { enum: string[] } } } } };
    };
    expect(schema.properties.issues.items.properties.principle_id.enum).toEqual(["law-hick"]);
  });
});

describe("parseEvaluation", () => {
  it("reads a good answer and maps the region to x, y, w, h", () => {
    const result = parseEvaluation(
      answer(note(), note({ principle_id: "nielsen-8", region: null })),
      {
        allowedIds,
        size,
      },
    );
    expect(result.dropped).toBe(0);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatchObject({
      principleId: "wcag-3.3.2",
      severity: "high",
      confidence: "high",
      region: { x: 100, y: 200, w: 300, h: 40 },
    });
    expect(result.issues[1]!.region).toBeNull();
  });

  it("accepts an empty list", () => {
    expect(parseEvaluation(answer(), { allowedIds, size })).toEqual({ issues: [], dropped: 0 });
  });

  it("drops invalid items and keeps the rest (partial answer)", () => {
    const result = parseEvaluation(
      answer(
        note(),
        note({ principle_id: "made-up" }),
        note({ severity: "critical" }),
        note({ title: "   " }),
        note({ region: { x: 5000, y: 10, width: 20, height: 20 } }),
        { title: "only a title" },
      ),
      { allowedIds, size },
    );
    expect(result.issues).toHaveLength(1);
    expect(result.dropped).toBe(5);
  });

  it("clamps boxes that reach past the edge", () => {
    const result = parseEvaluation(
      answer(note({ region: { x: -20, y: 780, width: 100, height: 100 } })),
      { allowedIds, size },
    );
    expect(result.issues[0]!.region).toEqual({ x: 0, y: 780, w: 80, h: 20 });
  });

  it("trims long text instead of failing", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const [issue] = parseEvaluation(answer(note({ title: long, detail: long, fix: long })), {
      allowedIds,
      size,
    }).issues;
    expect(issue!.title.split(" ")).toHaveLength(12);
    expect(issue!.title.endsWith("…")).toBe(true);
    expect(issue!.detail.split(" ")).toHaveLength(60);
    expect(issue!.fix.split(" ")).toHaveLength(45);
  });

  it("keeps at most 8 notes", () => {
    const many = Array.from({ length: 11 }, () => note());
    const result = parseEvaluation(answer(...many), { allowedIds, size });
    expect(result.issues).toHaveLength(MAX_EVALUATED_ISSUES);
    expect(result.dropped).toBe(3);
  });

  it("is unreadable when the text is not JSON (broken answer)", () => {
    const raw = "Here are my notes: {issues: [";
    const error = (() => {
      try {
        parseEvaluation(raw, { allowedIds, size });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(EvaluationUnreadableError);
    expect((error as EvaluationUnreadableError).raw).toBe(raw);
  });

  it("is unreadable without an issues list, or when every note is invalid", () => {
    expect(() => parseEvaluation('{"notes":[]}', { allowedIds, size })).toThrow(
      EvaluationUnreadableError,
    );
    expect(() =>
      parseEvaluation(answer(note({ principle_id: "x" }), note({ confidence: "sure" })), {
        allowedIds,
        size,
      }),
    ).toThrow(EvaluationUnreadableError);
  });
});

describe("helpers", () => {
  it("trimWords leaves short text alone and drops trailing punctuation", () => {
    expect(trimWords("  Short  title ", 8)).toBe("Short title");
    expect(trimWords("one, two, three, four", 2)).toBe("one, two…");
  });

  it("clampToImage refuses boxes outside or thinner than a pixel", () => {
    expect(clampToImage({ x: 1300, y: 0, width: 10, height: 10 }, size)).toBeNull();
    expect(clampToImage({ x: 10, y: 10, width: 0, height: 10 }, size)).toBeNull();
    expect(clampToImage({ x: 10.4, y: 9.6, width: 20, height: 20 }, size)).toEqual({
      x: 10,
      y: 10,
      w: 20,
      h: 20,
    });
  });
});
