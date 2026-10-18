/** Reads eval/cases/*.json (and checks the PNG next to each). Shared by the eval scripts. */
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { evalCaseSchema, type EvalCase } from "../lib/eval/case.ts";
import type { ExpectedIssue } from "../lib/eval/score.ts";

export const root = path.resolve(import.meta.dirname, "..");
export const casesDir = path.join(root, "eval/cases");

export async function loadCases(only: string[] = []): Promise<(EvalCase & { png: string })[]> {
  let files: string[];
  try {
    files = (await readdir(casesDir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    files = [];
  }
  if (files.length === 0) throw new Error("No cases in eval/cases/. Run pnpm eval:capture first.");
  const cases: (EvalCase & { png: string })[] = [];
  for (const file of files) {
    const name = file.slice(0, -".json".length);
    if (only.length && !only.includes(name)) continue;
    const parsed = evalCaseSchema.safeParse(
      JSON.parse(await readFile(path.join(casesDir, file), "utf8")),
    );
    if (!parsed.success) throw new Error(`eval/cases/${file}: ${parsed.error.message}`);
    const png = path.join(casesDir, `${name}.png`);
    await access(png).catch(() => {
      throw new Error(`eval/cases/${name}.png is missing`);
    });
    cases.push({ ...parsed.data, png });
  }
  const unknown = only.filter((n) => !cases.some((c) => c.name === n));
  if (unknown.length) throw new Error(`Unknown case: ${unknown.join(", ")}`);
  return cases;
}

export function expectedOf(c: EvalCase): ExpectedIssue[] {
  return c.issues.map((i) => ({
    id: i.id,
    kind: i.kind,
    principleId: i.principle_id,
    note: i.note,
    box: i.box,
  }));
}

/** `--name value` and `--flag` arguments; repeated names collect into a list. */
export function parseArgs(argv: string[]): Map<string, string[]> {
  const args = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const next = argv[i + 1];
    const value = next !== undefined && !next.startsWith("--") ? (i++, next) : "";
    args.set(arg.slice(2), [...(args.get(arg.slice(2)) ?? []), value]);
  }
  return args;
}

/** eval/runs/<stem>.md that does not exist yet: <date>, then <date>-2, … */
export async function freshStem(dir: string, base: string): Promise<string> {
  const files = await readdir(dir).catch(() => [] as string[]);
  for (let n = 1; ; n++) {
    const stem = n === 1 ? base : `${base}-${n}`;
    if (!files.some((f) => f.startsWith(`${stem}.`))) return stem;
  }
}
