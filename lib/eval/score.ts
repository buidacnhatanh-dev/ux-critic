/**
 * Scoring for `pnpm eval` and `pnpm eval:measured` (docs/08). Results are matched to the expected
 * issues with the same matcher as Compare (docs/07): same principle, and region IoU ≥ 0.25 or
 * title similarity ≥ 0.5, best pairs first. Pure, no data access.
 */
import { matchIssues, type CompareSide } from "../compare.ts";
import type { Box, Confidence, Issue, IssueKind, Severity } from "../data/types.ts";

export type ExpectedIssue = {
  id: string;
  kind: IssueKind;
  principleId: string;
  note: string;
  box: Box | null;
};

export type ResultIssue = {
  number: number;
  kind: IssueKind;
  /** With seed rules as `rule:<key>` (lib/eval/rule-keys.ts). */
  principleId: string;
  title: string;
  detail: string;
  severity: Severity;
  confidence: Confidence | null;
  region: Box | null;
};

export type RunScore = {
  found: { expected: ExpectedIssue; result: ResultIssue }[];
  missed: ExpectedIssue[];
  unexpected: ResultIssue[];
};

type Size = { width: number; height: number };

function asIssue(
  id: string,
  number: number,
  kind: IssueKind,
  principleId: string,
  title: string,
  region: Box | null,
): Issue {
  return {
    id,
    number,
    kind,
    principleId,
    title,
    detail: "",
    fix: "",
    severity: "low",
    confidence: null,
    measurementId: null,
    region,
    pushback: null,
  };
}

/** Found, missed and unexpected for one run of one case. */
export function scoreRun(
  expected: readonly ExpectedIssue[],
  results: readonly ResultIssue[],
  size: Size,
): RunScore {
  const from: CompareSide = {
    ...size,
    measurements: [],
    issues: expected.map((e, i) => asIssue(`e${i}`, i + 1, e.kind, e.principleId, e.note, e.box)),
  };
  const to: CompareSide = {
    ...size,
    measurements: [],
    issues: results.map((r, i) =>
      asIssue(`r${i}`, r.number, r.kind, r.principleId, r.title, r.region),
    ),
  };
  const pairs = matchIssues(from, to);
  const expectedIndex = (issue: Issue) => Number(issue.id.slice(1));
  const resultIndex = (issue: Issue) => Number(issue.id.slice(1));
  const matchedExpected = new Set(pairs.map((p) => expectedIndex(p.from)));
  const matchedResults = new Set(pairs.map((p) => resultIndex(p.to)));
  return {
    found: pairs
      .map((p) => ({
        expected: expected[expectedIndex(p.from)]!,
        result: results[resultIndex(p.to)]!,
      }))
      .sort((a, b) => expected.indexOf(a.expected) - expected.indexOf(b.expected)),
    missed: expected.filter((_, i) => !matchedExpected.has(i)),
    unexpected: results.filter((_, i) => !matchedResults.has(i)),
  };
}

export type Spread = { min: number; max: number; mean: number };

export function spread(values: readonly number[]): Spread {
  if (values.length === 0) return { min: 0, max: 0, mean: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
  };
}

/** Found ÷ expected, or null when nothing was expected (a clean case has no recall). */
export function recall(found: number, expected: number): number | null {
  return expected > 0 ? found / expected : null;
}
