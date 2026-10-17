import type { Ref, TextareaHTMLAttributes } from "react";
import { FieldShell } from "./Field";
import styles from "./Field.module.css";
import { describedBy, useFieldIds, type FieldBaseProps } from "./fieldIds";

export type TextareaProps = FieldBaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "aria-invalid" | "aria-describedby"> & {
    ref?: Ref<HTMLTextAreaElement>;
  };

export function Textarea({
  label,
  hint,
  error,
  id,
  rows = 3,
  className,
  ref,
  ...rest
}: TextareaProps) {
  const { inputId, hintId, errorId } = useFieldIds({ id, hint, error });
  return (
    <FieldShell {...{ inputId, label, hint, hintId, error, errorId }}>
      <textarea
        {...rest}
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(errorId, hintId)}
        className={[styles.control, styles.textarea, className].filter(Boolean).join(" ")}
      />
    </FieldShell>
  );
}
