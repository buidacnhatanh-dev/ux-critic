/** Principles catalogue (docs/05-principles.md). Ids are stable and stored with every issue. */

export type PrincipleSource = "nielsen" | "wcag" | "laws" | "mine";

export type Principle = {
  id: string;
  source: Exclude<PrincipleSource, "mine">;
  /** Shown after "Based on". */
  name: string;
  /** Shorter form for compact lists ("Nielsen 1", "Hick's law"). */
  shortName: string;
  /** One line meaning for the evaluation prompt. */
  meaning: string;
};

const nielsen = (n: number, title: string, meaning: string): Principle => ({
  id: `nielsen-${n}`,
  source: "nielsen",
  name: `Nielsen ${n}: ${title}`,
  shortName: `Nielsen ${n}`,
  meaning,
});

const wcag = (sc: string, title: string, meaning: string): Principle => ({
  id: `wcag-${sc}`,
  source: "wcag",
  name: `WCAG ${sc} ${title}`,
  shortName: `WCAG ${sc} ${title}`,
  meaning,
});

const law = (id: string, name: string, meaning: string): Principle => ({
  id: `law-${id}`,
  source: "laws",
  name,
  shortName: name,
  meaning,
});

export const PRINCIPLES: Principle[] = [
  nielsen(1, "Visibility of system status", "People can tell what is happening and where they are"),
  nielsen(2, "Match with the real world", "Words and concepts are familiar to the people using it"),
  nielsen(3, "User control and freedom", "Easy to undo, go back or leave"),
  nielsen(
    4,
    "Consistency and standards",
    "Same things look and work the same, platform conventions are followed",
  ),
  nielsen(5, "Error prevention", "The design prevents mistakes before they happen"),
  nielsen(
    6,
    "Recognition rather than recall",
    "Options and information are visible, not remembered",
  ),
  nielsen(7, "Flexibility and efficiency", "Fast paths exist for frequent tasks"),
  nielsen(8, "Aesthetic and minimalist design", "Nothing competes with what matters"),
  nielsen(9, "Help with errors", "Errors say what went wrong and how to fix it"),
  nielsen(10, "Help and documentation", "Help is available where it is needed"),
  wcag(
    "1.4.3",
    "Contrast",
    "Text contrast at least 4.5 : 1 (3 : 1 for large text). Usually measured, do not evaluate unless text sits on an image or gradient",
  ),
  wcag(
    "1.4.11",
    "Non text contrast",
    "Control borders, icons and focus indicators at least 3 : 1 against neighbours",
  ),
  wcag("1.4.1", "Use of colour", "Colour is not the only way to show meaning, state or errors"),
  wcag(
    "2.5.8",
    "Target size",
    "Targets at least 24 by 24 CSS px. Usually measured, do not evaluate",
  ),
  wcag("3.3.2", "Labels or instructions", "Inputs have visible labels; placeholder is not a label"),
  wcag("3.3.1", "Error identification", "Errors are described in text next to the field"),
  wcag("2.4.6", "Headings and labels", "Headings and labels describe the content"),
  wcag("1.3.1", "Info and relationships", "Visual grouping and structure make relationships clear"),
  law("hick", "Hick's law", "More choices at once means slower decisions"),
  law("fitts", "Fitts's law", "Important targets are large and close to where attention is"),
  law("jakob", "Jakob's law", "People expect it to work like other products they know"),
  law("miller", "Miller's law", "Too many items at once overload memory; group them"),
  law("proximity", "Law of proximity", "Things that belong together are close together"),
  law("similarity", "Law of similarity", "Things that look alike are read as related"),
  law("common-region", "Law of common region", "Shared boundaries group content"),
  law(
    "von-restorff",
    "Von Restorff effect",
    "The one thing that should stand out does, and only that",
  ),
  law(
    "serial-position",
    "Serial position effect",
    "Key items sit at the start or end of a sequence",
  ),
  law(
    "aesthetic-usability",
    "Aesthetic usability effect",
    "Visual quality affects perceived usability, polish matters",
  ),
];

const BY_ID = new Map(PRINCIPLES.map((p) => [p.id, p]));

export function getPrinciple(id: string): Principle | undefined {
  return BY_ID.get(id);
}

/** Rule texts by rule id, from the checklist. */
export type RuleTexts = ReadonlyMap<string, string> | Record<string, string>;

function ruleText(id: string, rules: RuleTexts): string | undefined {
  return rules instanceof Map ? rules.get(id) : (rules as Record<string, string>)[id];
}

/**
 * Display name for "Based on <name>". Own rules are `rule:<id>` and read "My rule: <text>".
 * A rule that was deleted since the review still gets a readable name.
 */
export function principleName(id: string, rules: RuleTexts = {}): string {
  if (id.startsWith("rule:")) {
    const text = ruleText(id.slice(5), rules);
    return text ? `My rule: ${text}` : "My rule (deleted since)";
  }
  return getPrinciple(id)?.name ?? id;
}

export function principleShortName(id: string, rules: RuleTexts = {}): string {
  if (id.startsWith("rule:")) return principleName(id, rules);
  return getPrinciple(id)?.shortName ?? id;
}
