import type { ReactNode } from "react";
import styles from "./Pill.module.css";

export type Severity = "high" | "medium" | "low";
export type IssueKind = "measured" | "evaluated";
export type PillTone = Severity | IssueKind | "neutral" | "demo";

export type PillProps = {
  tone: PillTone;
  /** Always text: colour never carries meaning alone (CLAUDE.md). */
  children: ReactNode;
  icon?: ReactNode;
};

export function Pill({ tone, children, icon }: PillProps) {
  return (
    <span className={[styles.pill, styles[tone]].join(" ")} data-tone={tone}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

/** "High 2" style count pill. A zero count is shown neutral, as in the designs. */
export function SeverityCountPill({ severity, count }: { severity: Severity; count: number }) {
  return (
    <Pill tone={count === 0 ? "neutral" : severity}>
      {SEVERITY_LABEL[severity]} {count}
    </Pill>
  );
}

export function SeverityPill({ severity }: { severity: Severity }) {
  return <Pill tone={severity}>{SEVERITY_LABEL[severity]}</Pill>;
}

export function KindPill({ kind }: { kind: IssueKind }) {
  return <Pill tone={kind}>{kind === "measured" ? "Measured" : "Evaluated"}</Pill>;
}
