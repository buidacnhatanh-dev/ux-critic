import { SeverityCountPill } from "@/components/ui";
import type { SeverityCounts as Counts } from "@/lib/data/types";
import styles from "./SeverityCounts.module.css";

/** "High 0 · Medium 2 · Low 1" pills, always with text. */
export function SeverityCounts({ counts }: { counts: Counts }) {
  return (
    <p className={styles.counts}>
      <SeverityCountPill severity="high" count={counts.high} />
      <SeverityCountPill severity="medium" count={counts.medium} />
      <SeverityCountPill severity="low" count={counts.low} />
    </p>
  );
}
