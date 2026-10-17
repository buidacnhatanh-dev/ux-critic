import type { Ref, SelectHTMLAttributes } from "react";
import { FieldShell } from "./Field";
import styles from "./Field.module.css";
import { describedBy, useFieldIds, type FieldBaseProps } from "./fieldIds";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = FieldBaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "aria-invalid" | "aria-describedby"> & {
    options: SelectOption[];
    ref?: Ref<HTMLSelectElement>;
  };

export function Select({ label, hint, error, id, options, className, ref, ...rest }: SelectProps) {
  const { inputId, hintId, errorId } = useFieldIds({ id, hint, error });
  return (
    <FieldShell {...{ inputId, label, hint, hintId, error, errorId }}>
      <span className={styles.selectWrap}>
        <select
          {...rest}
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(errorId, hintId)}
          className={[styles.control, styles.select, className].filter(Boolean).join(" ")}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className={styles.chevron}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </FieldShell>
  );
}
