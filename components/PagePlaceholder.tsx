import type { ReactNode } from "react";
import styles from "./PagePlaceholder.module.css";

/** Empty page for a route that is not built yet. Shows the title only and where it comes from. */
export function PagePlaceholder({ title, note }: { title: string; note: ReactNode }) {
  return (
    <>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.note}>{note}</p>
    </>
  );
}
