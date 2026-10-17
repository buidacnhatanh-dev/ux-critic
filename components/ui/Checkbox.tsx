import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import styles from "./Choice.module.css";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  label: string;
  description?: string;
  id?: string;
  ref?: Ref<HTMLInputElement>;
};

/** Native checkbox, 22 px box, the whole row is clickable. */
export function Checkbox({ label, description, id, className, ref, ...rest }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const labelId = `${inputId}-label`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  return (
    <label
      htmlFor={inputId}
      className={[styles.row, className].filter(Boolean).join(" ")}
      data-disabled={rest.disabled || undefined}
    >
      <input
        {...rest}
        ref={ref}
        id={inputId}
        type="checkbox"
        className={styles.input}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
      />
      <span className={styles.text}>
        <span id={labelId} className={styles.title}>
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Groups related checkboxes in a fieldset with a legend. */
export function CheckboxGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      {children}
    </fieldset>
  );
}
