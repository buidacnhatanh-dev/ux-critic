/**
 * The evaluation report (docs/08): eval/runs/<date>.md from the saved results and the owner's
 * verdicts on unexpected notes (eval/runs/<date>.review.json). Pure, so the report can be made
 * again after the verdicts change without calling Claude again.
 */
import type { IssueKind, ReviewStatus } from "../data/types.ts";
import {
  recall,
  scoreRun,
  spread,
  type ExpectedIssue,
  type ResultIssue,
  type RunScore,
  type Spread,
} from "./score.ts";

export type EvalRun = {
  run: number;
  status: ReviewStatus;
  /** The error message of a failed or partial review. */
  error: string | null;
  /** The model that answered (from the API response), null when none did. */
  model: string | null;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  /** Measured checks that did not run, as "target_size: failed". */
  skippedChecks: string[];
  issues: ResultIssue[];
};

export type EvalCaseResult = {
  name: string;
  description: string;
  width: number;
  height: number;
  expected: ExpectedIssue[];
  runs: EvalRun[];
};

export type EvalResults = {
  version: 1;
  startedAt: string;
  finishedAt: string;
  /** UXC_FAKE_AI=1: answers came from lib/fake-ai.ts. Such a report measures nothing. */
  fakeAi: boolean;
  requestedModel: string;
  runsPerCase: number;
  cases: EvalCaseResult[];
};

export type Verdict = "real" | "invented";

export type ReviewFile = {
  $comment: string;
  notes: Record<
    string,
    {
      case: string;
      run: number;
      kind: IssueKind;
      principle: string;
      title: string;
      verdict: Verdict | null;
    }
  >;
};

export const REVIEW_COMMENT =
  'Set "verdict" of each unexpected note to "real" (a true problem the case did not plant) or "invented" (not a real problem), then run pnpm eval --report <results file> to count them.';

export function unexpectedId(caseName: string, run: number, number: number): string {
  return `${caseName}/run-${run}/#${number}`;
}

/** The review file with every unexpected note, keeping verdicts already set. */
export function reviewTemplate(results: EvalResults, existing: ReviewFile | null): ReviewFile {
  const notes: ReviewFile["notes"] = {};
  for (const c of results.cases) {
    for (const run of c.runs) {
      for (const issue of scoreRun(c.expected, run.issues, c).unexpected) {
        const id = unexpectedId(c.name, run.run, issue.number);
        notes[id] = {
          case: c.name,
          run: run.run,
          kind: issue.kind,
          principle: issue.principleId,
          title: issue.title,
          verdict: existing?.notes[id]?.verdict ?? null,
        };
      }
    }
  }
  return { $comment: REVIEW_COMMENT, notes };
}

type Scored = { c: EvalCaseResult; scores: RunScore[] };

const pct = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)} %`);
const num = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const range = (s: Spread) => (s.min === s.max ? num(s.min) : `${num(s.min)}–${num(s.max)}`);
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

function countKind(items: { kind: IssueKind }[], kind: IssueKind) {
  return items.filter((i) => i.kind === kind).length;
}

export function renderReport(results: EvalResults, review: ReviewFile | null): string {
  const scored: Scored[] = results.cases.map((c) => ({
    c,
    scores: c.runs.map((run) => scoreRun(c.expected, run.issues, c)),
  }));
  const runNumbers = Array.from({ length: results.runsPerCase }, (_, i) => i + 1);
  const expectedTotal = scored.reduce((sum, s) => sum + s.c.expected.length, 0);
  const allRuns = results.cases.flatMap((c) => c.runs);
  const answered = allRuns.filter((r) => r.status !== "failed");
  const failed = allRuns.length - answered.length;
  const models = [...new Set(allRuns.map((r) => r.model).filter((m): m is string => !!m))];

  /** Totals of one run number across every case. */
  const perRun = runNumbers.map((n) => {
    let found = 0;
    let unexpected = 0;
    for (const s of scored) {
      const i = s.c.runs.findIndex((r) => r.run === n);
      if (i < 0) continue;
      found += s.scores[i]!.found.length;
      unexpected += s.scores[i]!.unexpected.length;
    }
    return {
      found,
      missed: expectedTotal - found,
      unexpected,
      recall: recall(found, expectedTotal),
    };
  });

  const verdicts = { real: 0, invented: 0, open: 0 };
  for (const s of scored) {
    s.scores.forEach((score, i) => {
      for (const issue of score.unexpected) {
        const v = review?.notes[unexpectedId(s.c.name, s.c.runs[i]!.run, issue.number)]?.verdict;
        if (v === "real") verdicts.real++;
        else if (v === "invented") verdicts.invented++;
        else verdicts.open++;
      }
    });
  }

  const lines: string[] = [];
  const date = results.startedAt.slice(0, 10);
  lines.push(`# Evaluation run ${date}`, "");
  if (results.fakeAi) {
    lines.push(
      "> **Fake AI mode (`UXC_FAKE_AI=1`).** Claude was not called: every evaluated note is the same fixture from `lib/fake-ai.ts`, whatever the screenshot. This report only proves the harness works. Its numbers say nothing about review quality and must not be used anywhere.",
      "",
    );
  }
  lines.push(
    `* Model: ${models.length ? models.join(", ") : "none answered"} (requested ${results.requestedModel})`,
    `* Started ${results.startedAt}, finished ${results.finishedAt}`,
    `* ${results.cases.length} cases, ${results.runsPerCase} runs each, ${expectedTotal} planted problems per run`,
    `* Matching: the Compare matcher (docs/07): same principle, region overlap (IoU ≥ 0.25) or similar title`,
    "",
    "These numbers are never copied into the app or the docs automatically.",
    "",
  );

  // Totals
  const foundSpread = spread(perRun.map((r) => r.found));
  const recallSpread = spread(perRun.map((r) => r.recall ?? 0));
  const unexpectedSpread = spread(perRun.map((r) => r.unexpected));
  lines.push("## Totals", "");
  lines.push(
    `Found ${range(foundSpread)} of ${expectedTotal} planted problems per run (mean ${num(foundSpread.mean)}), recall ${pct(recallSpread.mean)} (runs ${perRun.map((r) => pct(r.recall)).join(", ")}). ${range(unexpectedSpread)} unexpected notes per run.`,
    "",
  );
  lines.push(
    `Unexpected notes, all runs: ${verdicts.real + verdicts.invented + verdicts.open} (${verdicts.real} real, ${verdicts.invented} invented, ${verdicts.open} not reviewed yet).`,
    "",
  );
  lines.push(`| | ${runNumbers.map((n) => `Run ${n}`).join(" | ")} |`);
  lines.push(`|---|${runNumbers.map(() => "---:").join("|")}|`);
  lines.push(`| Found | ${perRun.map((r) => r.found).join(" | ")} |`);
  lines.push(`| Missed | ${perRun.map((r) => r.missed).join(" | ")} |`);
  lines.push(`| Unexpected | ${perRun.map((r) => r.unexpected).join(" | ")} |`);
  lines.push(`| Recall | ${perRun.map((r) => pct(r.recall)).join(" | ")} |`);
  lines.push("");
  if (failed > 0) {
    lines.push(
      `${failed} of ${allRuns.length} reviews failed; their planted problems count as missed.`,
      "",
    );
  }

  // Measured vs evaluated
  lines.push("## Measured vs evaluated", "");
  lines.push(
    "Found and missed are split by the kind of the planted problem, unexpected by the kind of the note. Means per run.",
    "",
  );
  lines.push("| Kind | Planted | Found | Recall | Unexpected |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const kind of ["measured", "evaluated"] as const) {
    const planted = scored.reduce((sum, s) => sum + countKind(s.c.expected, kind), 0);
    const runs = Math.max(results.runsPerCase, 1);
    let found = 0;
    let unexpected = 0;
    for (const s of scored) {
      for (const score of s.scores) {
        found += countKind(
          score.found.map((f) => f.expected),
          kind,
        );
        unexpected += countKind(score.unexpected, kind);
      }
    }
    lines.push(
      `| ${kind === "measured" ? "Measured" : "Evaluated"} | ${planted} | ${num(found / runs)} | ${pct(recall(found / runs, planted))} | ${num(unexpected / runs)} |`,
    );
  }
  lines.push("");

  // Per case
  lines.push("## Per case", "");
  lines.push("| Case | Planted | Found | Missed | Unexpected | Failed runs |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const s of scored) {
    const failedRuns = s.c.runs.filter((r) => r.status === "failed").length;
    lines.push(
      `| ${s.c.name} | ${s.c.expected.length} | ${range(spread(s.scores.map((x) => x.found.length)))} | ${range(spread(s.scores.map((x) => x.missed.length)))} | ${range(spread(s.scores.map((x) => x.unexpected.length)))} | ${failedRuns} |`,
    );
  }
  lines.push("", "Ranges are min–max over the runs.", "");

  // Time and tokens
  lines.push("## Time and tokens", "");
  if (answered.length === 0) {
    lines.push("No review got an answer.", "");
  } else {
    const time = spread(answered.map((r) => r.durationMs / 1000));
    const withTokens = answered.filter((r) => r.inputTokens !== null && r.outputTokens !== null);
    lines.push(
      `* Time per review (measuring with OCR and both Claude calls): mean ${time.mean.toFixed(1)} s, ${time.min.toFixed(1)}–${time.max.toFixed(1)} s`,
    );
    if (withTokens.length) {
      const input = spread(withTokens.map((r) => r.inputTokens!));
      const output = spread(withTokens.map((r) => r.outputTokens!));
      lines.push(
        `* Tokens per review: input mean ${Math.round(input.mean)} (${input.min}–${input.max}), output mean ${Math.round(output.mean)} (${output.min}–${output.max})`,
      );
    } else {
      lines.push("* Tokens per review: none recorded");
    }
    lines.push("");
  }
  if (allRuns.some((r) => r.status !== "done" || r.skippedChecks.length)) {
    lines.push("Reviews that did not finish cleanly:", "");
    for (const s of scored) {
      for (const run of s.c.runs) {
        if (run.status === "done" && run.skippedChecks.length === 0) continue;
        const parts: string[] = [run.status];
        if (run.error) parts.push(run.error);
        if (run.skippedChecks.length) parts.push(`skipped ${run.skippedChecks.join(", ")}`);
        lines.push(`* ${s.c.name} run ${run.run}: ${cell(parts.join("; "))}`);
      }
    }
    lines.push("");
  }

  // Missed
  lines.push("## Missed", "");
  let anyMissed = false;
  for (const s of scored) {
    for (const e of s.c.expected) {
      const missedIn = s.scores.filter((score) => score.missed.includes(e)).length;
      if (missedIn === 0) continue;
      anyMissed = true;
      const elsewhere = s.scores.filter(
        (score, i) =>
          score.missed.includes(e) &&
          s.c.runs[i]!.issues.some((issue) => issue.principleId === e.principleId),
      ).length;
      lines.push(
        `* ${s.c.name} · ${e.id} (${e.kind}, ${e.principleId}): missed in ${missedIn} of ${s.scores.length} runs${elsewhere ? `; in ${elsewhere} of those a note with the same principle was placed elsewhere` : ""}. ${cell(e.note)}`,
      );
    }
  }
  if (!anyMissed) lines.push("Nothing missed.");
  lines.push("");

  // Unexpected
  lines.push("## Unexpected notes to review", "");
  let anyUnexpected = false;
  for (const s of scored) {
    s.scores.forEach((score, i) => {
      const run = s.c.runs[i]!;
      for (const issue of score.unexpected) {
        anyUnexpected = true;
        const id = unexpectedId(s.c.name, run.run, issue.number);
        const verdict = review?.notes[id]?.verdict ?? "not reviewed";
        const extra = issue.confidence ? `, confidence ${issue.confidence}` : "";
        lines.push(
          `* \`${id}\` ${issue.kind}, ${issue.principleId}, ${issue.severity}${extra}: **${cell(issue.title)}** ${cell(issue.detail)} *Verdict: ${verdict}*`,
        );
      }
    });
  }
  if (!anyUnexpected) lines.push("None.");
  lines.push("");
  return lines.join("\n");
}
