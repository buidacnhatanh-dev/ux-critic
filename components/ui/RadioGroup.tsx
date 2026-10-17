"use client";

import { useId, useState, type ChangeEvent } from "react";
import { ErrorIcon } from "./ErrorIcon";
import styles from "./Choice.module.css";

export type RadioOption = { value: string; label: string; description?: string };

export type RadioGroupProps = {
  legend: string;
  name: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  hint?: string;
  error?: string;
};

/** Native radios in a fieldset with a legend. Controlled with `value`, or uncontrolled. */
export function RadioGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onChange,
  hint,
  error,
}: RadioGroupProps) {
  const groupId = useId();
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const hintId = hint ? `${groupId}-hint` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (value === undefined) setInternal(event.target.value);
    onChange?.(event.target.value);
  }

  return (
    <fieldset className={styles.fieldset} aria-describedby={describedBy}>
      <legend className={styles.legend}>{legend}</legend>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error}>
          <span className={styles.errorIcon}>
            <ErrorIcon />
          </span>
          {error}
        </p>
      ) : null}
      {options.map((option) => {
        const id = `${groupId}-${option.value}`;
        const labelId = `${id}-label`;
        const descriptionId = option.description ? `${id}-description` : undefined;
        return (
          <label key={option.value} htmlFor={id} className={styles.row}>
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={current === option.value}
              onChange={handleChange}
              className={styles.input}
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
            />
            <span className={styles.text}>
              <span id={labelId} className={styles.title}>
                {option.label}
              </span>
              {option.description ? (
                <span id={descriptionId} className={styles.description}>
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
