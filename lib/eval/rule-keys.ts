/**
 * Seed rules get random ids in each database, so cases refer to them by a stable key
 * (`rule:<key>`, the same keys as demo/handwritten.json). Matched by the seed text.
 */
export const RULE_KEYS: Record<string, string> = {
  "Touch targets are at least 44 by 44 px": "targets-44",
  "Body text is at least 16 px": "body-text-16",
  "Every field has a visible label": "visible-labels",
  "One primary button per screen": "one-primary-button",
  "Error messages say how to fix the problem": "errors-say-how",
  "Colour is never the only way to show a state": "colour-never-alone",
};

/** `rule:<uuid>` becomes `rule:<key>` when the rule is a seed rule; anything else is unchanged. */
export function toCasePrincipleId(
  principleId: string,
  rules: readonly { id: string; text: string }[],
): string {
  if (!principleId.startsWith("rule:")) return principleId;
  const rule = rules.find((r) => r.id === principleId.slice(5));
  const key = rule ? RULE_KEYS[rule.text] : undefined;
  return key ? `rule:${key}` : principleId;
}
