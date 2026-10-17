import type { InputHTMLAttributes, Ref } from "react";
import { FieldShell } from "./Field";
import styles from "./Field.module.css";
import { describedBy, useFieldIds, type FieldBaseProps } from "./fieldIds";

export type TextFieldProps = FieldBaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-invalid" | "aria-describedby"> & {
    ref?: Ref<HTMLInputElement>;
  };

export function TextField({
  label,
  hint,
  error,
  id,
  type = "text",
  className,
  ref,
  ...rest
}: TextFieldProps) {
  const { inputId, hintId, errorId } = useFieldIds({ id, hint, error });
  return (
    <FieldShell {...{ inputId, label, hint, hintId, error, errorId }}>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(errorId, hintId)}
        className={[styles.control, className].filter(Boolean).join(" ")}
      />
    </FieldShell>
  );
}
