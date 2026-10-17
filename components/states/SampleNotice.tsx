import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./SampleNotice.module.css";

/** Marks a /states page as sample data (docs/10). */
export function SampleNotice({ children }: { children: ReactNode }) {
  return (
    <aside aria-label="About this sample" className={styles.notice}>
      <p className={styles.text}>
        <strong>Sample state.</strong> {children}
      </p>
      <Link href="/states" className={styles.link}>
        All screen states
      </Link>
    </aside>
  );
}
