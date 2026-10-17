import type { Checklist, ChecklistUpdate, Rule } from "./types";

function renumber(rules: Rule[]): Rule[] {
  return rules.map((rule, i) => ({ ...rule, position: i + 1 }));
}

/** Applies one checklist change. Pure, shared by both clients' tests and the demo overlay. */
export function applyChecklistUpdate(
  checklist: Checklist,
  update: ChecklistUpdate,
  newId: () => string,
): Checklist {
  const rules = [...checklist.rules].sort((a, b) => a.position - b.position);
  switch (update.type) {
    case "sources":
      return { ...checklist, sources: { ...update.sources } };
    case "createRule": {
      const text = update.rule.text.trim();
      if (!text) throw new Error("A rule needs text.");
      return {
        ...checklist,
        rules: renumber([...rules, { ...update.rule, text, id: newId(), position: 0 }]),
      };
    }
    case "updateRule": {
      const index = rules.findIndex((r) => r.id === update.rule.id);
      if (index === -1) throw new Error(`No rule ${update.rule.id}`);
      const text = update.rule.text.trim();
      if (!text) throw new Error("A rule needs text.");
      rules[index] = { ...update.rule, text, position: rules[index]!.position };
      return { ...checklist, rules: renumber(rules) };
    }
    case "deleteRule":
      return { ...checklist, rules: renumber(rules.filter((r) => r.id !== update.ruleId)) };
    case "restoreRule": {
      if (rules.some((r) => r.id === update.rule.id)) return checklist;
      const at = Math.min(Math.max(update.rule.position - 1, 0), rules.length);
      rules.splice(at, 0, update.rule);
      return { ...checklist, rules: renumber(rules) };
    }
    case "moveRule": {
      const index = rules.findIndex((r) => r.id === update.ruleId);
      const target = update.direction === "up" ? index - 1 : index + 1;
      if (index === -1 || target < 0 || target >= rules.length) return checklist;
      [rules[index], rules[target]] = [rules[target]!, rules[index]!];
      return { ...checklist, rules: renumber(rules) };
    }
  }
}
