import type { ReactNode } from "react";
import { ErrorIcon } from "./ErrorIcon";
import styles from "./Field.module.css";

type FieldShellProps = {
  inputId: string;
  label: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
};

/** Layout for a labelled control: label, hint, control, error. Internal to components/ui. */
export function FieldShell({
  inputId,
  label,
  hint,
  hintId,
  error,
  errorId,
  children,
}: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className={styles.error}>
          <span className={styles.errorIcon}>
            <ErrorIcon />
          </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
