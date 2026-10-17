import { useId } from "react";

export type FieldBaseProps = {
  label: string;
  hint?: string;
  /** Shown after submit (CLAUDE.md: errors appear on submit, not while typing). */
  error?: string;
  id?: string;
};

/** Ids and ARIA attributes shared by TextField, Textarea and Select. */
export function useFieldIds({ id, hint, error }: Pick<FieldBaseProps, "id" | "hint" | "error">) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return { inputId, hintId, errorId };
}

/** Joins describedby ids, error first so it is read before the hint. */
export function describedBy(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined || undefined;
}
