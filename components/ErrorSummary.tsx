"use client";

import { useId, type Ref } from "react";
import { errorSummaryTitle, type FieldError } from "@/lib/new-review";
import styles from "./ErrorSummary.module.css";

/**
 * Error summary at the top of a form (CLAUDE.md, docs/06 §13). The form focuses it on submit;
 * each error links to its field and moves focus there.
 */
export function ErrorSummary({ errors, ref }: { errors: FieldError[]; ref?: Ref<HTMLDivElement> }) {
  const titleId = useId();
  if (errors.length === 0) return null;
  return (
    <div ref={ref} role="alert" tabIndex={-1} aria-labelledby={titleId} className={styles.summary}>
      <h2 id={titleId} className={styles.title}>
        {errorSummaryTitle(errors.length)}
      </h2>
      <ul className={styles.list}>
        {errors.map((error) => (
          <li key={`${error.field}-${error.summary}`}>
            <a
              href={`#${error.field}`}
              className={styles.link}
              onClick={(event) => {
                const field = document.getElementById(error.field);
                if (!field) return;
                event.preventDefault();
                field.focus();
                field.scrollIntoView({ block: "center" });
              }}
            >
              {error.summary}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
