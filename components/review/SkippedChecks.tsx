import type { SkippedCheck } from "@/lib/data/types";
import { skippedCheckNotes } from "@/lib/skipped-checks";
import styles from "./SkippedChecks.module.css";

/** Measured checks that did not run, and why. Nothing when every check ran. */
export function SkippedChecks({ skipped }: { skipped: SkippedCheck[] | undefined }) {
  const notes = skippedCheckNotes(skipped);
  if (notes.length === 0) return null;
  return (
    <>
      {notes.map((note) => (
        <div key={note.key} className={styles.note}>
          <p className={styles.text}>{note.text}</p>
          {note.detail ? (
            <details className={styles.details}>
              <summary className={styles.summary}>Technical details</summary>
              <pre className={styles.pre}>{note.detail}</pre>
            </details>
          ) : null}
        </div>
      ))}
    </>
  );
}
