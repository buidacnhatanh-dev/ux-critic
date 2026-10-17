import type { Ref, SelectHTMLAttributes } from "react";
import { FieldShell } from "./Field";
import styles from "./Field.module.css";
import { describedBy, useFieldIds, type FieldBaseProps } from "./fieldIds";

export type SelectOption = { value: string; label: string };

export type SelectProps = FieldBaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "aria-invalid" | "aria-describedby"> & {
    options: SelectOption[];
    ref?: Ref<HTMLSelectElement>;
  };

export function Select({ label, hint, error, id, options, className, ref, ...rest }: SelectProps) {
  const { inputId, hintId, errorId } = useFieldIds({ id, hint, error });
  return (
    <FieldShell {...{ inputId, label, hint, hintId, error, errorId }}>
      <select
        {...rest}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(errorId, hintId)}
        className={[styles.control, className].filter(Boolean).join(" ")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
