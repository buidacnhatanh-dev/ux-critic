"use client";

import { Button, ButtonLink } from "@/components/ui";
import styles from "./FirstUse.module.css";

const STEPS = [
  ["Drop a screenshot", "One screen at a time, PNG, JPG or WebP."],
  ["Read the notes", "Measured in black, evaluated in blue."],
  ["Push back", "Say why a note is wrong. Your reasons are kept."],
] as const;

/** Screen 7: Projects when there are none. In the demo it also offers Reset demo (docs/10). */
export function FirstUse({ onResetDemo }: { onResetDemo?: () => void }) {
  return (
    <div className={styles.wrap}>
      <svg
        width="200"
        height="140"
        viewBox="0 0 200 140"
        aria-hidden="true"
        focusable="false"
        className={styles.art}
      >
        <rect
          x="30"
          y="14"
          width="140"
          height="112"
          rx="10"
          className={styles.artFrame}
          strokeWidth="2"
        />
        <rect x="48" y="34" width="60" height="8" rx="3" className={styles.artLine} />
        <rect
          x="48"
          y="52"
          width="104"
          height="14"
          rx="4"
          className={styles.artField}
          strokeWidth="1.5"
        />
        <rect
          x="48"
          y="74"
          width="104"
          height="14"
          rx="4"
          className={styles.artField}
          strokeWidth="1.5"
        />
        <rect x="48" y="98" width="52" height="16" rx="4" className={styles.artButton} />
        <rect
          x="42"
          y="69"
          width="116"
          height="24"
          rx="6"
          fill="none"
          className={styles.artEvaluated}
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        <circle cx="42" cy="69" r="10" className={styles.artButton} />
        <text
          x="42"
          y="73"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          className={styles.artNumber}
        >
          1
        </text>
        <rect
          x="44"
          y="47"
          width="112"
          height="24"
          rx="6"
          fill="none"
          className={styles.artMeasured}
          strokeWidth="2"
        />
        <circle cx="156" cy="47" r="10" className={styles.artInk} />
        <text
          x="156"
          y="51"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          className={styles.artNumber}
        >
          2
        </text>
      </svg>
      <h1 className={styles.title}>Review your first design</h1>
      <p className={styles.lead}>
        Drop in a screenshot of something you made. You get measured facts, an evaluation based on
        UX principles, and a place to push back where you disagree.
      </p>
      <div className={styles.actions}>
        <ButtonLink
          href="/new"
          className={styles.start}
          icon={
            <svg width="16" height="16" viewBox="0 0 18 18" focusable="false">
              <path
                d="M9 3v12M3 9h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          }
        >
          Start a review
        </ButtonLink>
        {onResetDemo ? (
          <Button variant="secondary" onClick={onResetDemo}>
            Reset demo
          </Button>
        ) : null}
      </div>
      <ol className={styles.steps}>
        {STEPS.map(([title, text], index) => (
          <li key={title} className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">
              {index + 1}
            </span>
            <p className={styles.stepTitle}>{title}</p>
            <p className={styles.stepText}>{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
