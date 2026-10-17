import { applyChecklistUpdate } from "./checklist";
import type { Checklist, Rule } from "./types";

const rule = (id: string, position: number): Rule => ({
  id,
  text: `Rule ${id}`,
  kind: "evaluated",
  metric: null,
  threshold: null,
  position,
  enabled: true,
});

const base: Checklist = {
  sources: { nielsen: true, wcag: true, laws: true, mine: true },
  rules: [rule("a", 1), rule("b", 2), rule("c", 3)],
};
const ids = (c: Checklist) => c.rules.map((r) => r.id);
const newId = () => "new";

describe("applyChecklistUpdate", () => {
  it("sets sources", () => {
    const next = applyChecklistUpdate(
      base,
      { type: "sources", sources: { ...base.sources, laws: false } },
      newId,
    );
    expect(next.sources.laws).toBe(false);
    expect(base.sources.laws).toBe(true);
  });

  it("adds a trimmed rule at the end and refuses empty text", () => {
    const next = applyChecklistUpdate(
      base,
      {
        type: "createRule",
        rule: { text: "  x  ", kind: "evaluated", metric: null, threshold: null, enabled: true },
      },
      newId,
    );
    expect(next.rules.at(-1)).toMatchObject({ id: "new", text: "x", position: 4 });
    expect(() =>
      applyChecklistUpdate(
        base,
        {
          type: "createRule",
          rule: { text: " ", kind: "evaluated", metric: null, threshold: null, enabled: true },
        },
        newId,
      ),
    ).toThrow();
  });

  it("updates a rule in place", () => {
    const next = applyChecklistUpdate(
      base,
      { type: "updateRule", rule: { ...rule("b", 99), text: "B" } },
      newId,
    );
    expect(next.rules[1]).toMatchObject({ id: "b", text: "B", position: 2 });
  });

  it("deletes and renumbers", () => {
    const next = applyChecklistUpdate(base, { type: "deleteRule", ruleId: "a" }, newId);
    expect(next.rules.map((r) => [r.id, r.position])).toEqual([
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("moves up and down, and ignores moves past the ends", () => {
    expect(
      ids(applyChecklistUpdate(base, { type: "moveRule", ruleId: "c", direction: "up" }, newId)),
    ).toEqual(["a", "c", "b"]);
    expect(
      ids(applyChecklistUpdate(base, { type: "moveRule", ruleId: "a", direction: "down" }, newId)),
    ).toEqual(["b", "a", "c"]);
    expect(
      applyChecklistUpdate(base, { type: "moveRule", ruleId: "a", direction: "up" }, newId),
    ).toBe(base);
  });

  it("restores a deleted rule at its old position, once", () => {
    const deleted = applyChecklistUpdate(base, { type: "deleteRule", ruleId: "b" }, newId);
    expect(ids(deleted)).toEqual(["a", "c"]);
    const restored = applyChecklistUpdate(
      deleted,
      { type: "restoreRule", rule: rule("b", 2) },
      newId,
    );
    expect(ids(restored)).toEqual(["a", "b", "c"]);
    expect(restored.rules.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(applyChecklistUpdate(restored, { type: "restoreRule", rule: rule("b", 2) }, newId)).toBe(
      restored,
    );
  });
});
