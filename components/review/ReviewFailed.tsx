"use client";

import { useEffect, useRef } from "react";
import { Breadcrumb, type Crumb } from "@/components/Breadcrumb";
import { useNavSection } from "@/components/NavSection";
import { Button, ButtonLink } from "@/components/ui";
import type { ReviewDetail } from "@/lib/data/types";
import { errorSentence, STEP_LABEL, STEPS } from "@/lib/reviewing";
import styles from "./ReviewFailed.module.css";

/** Screen 10: the review stopped. Focus moves to the heading. */
export function ReviewFailed({
  review,
  crumbs,
  onTryAgain,
  changeSettingsHref,
}: {
  review: ReviewDetail;
  crumbs: Crumb[];
  onTryAgain: () => void;
  changeSettingsHref: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  // Still part of starting a new review (design 10).
  useNavSection("/new");

  const message = review.error?.message ?? "No error message was saved.";
  const measuredDone = STEPS.indexOf(review.step) > STEPS.indexOf("measure");
  const details = [
    message,
    `Step: ${STEP_LABEL[review.step]}`,
    `Measured checks: ${measuredDone ? "finished (saved)" : "not finished"}`,
    review.error?.detail ?? null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <Breadcrumb items={crumbs} />
      <div className={styles.box}>
        <span className={styles.icon} aria-hidden="true">
          !
        </span>
        <div className={styles.body}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            The review didn&apos;t finish
          </h1>
          <p className={styles.message}>{errorSentence(message)}</p>
          <p className={styles.saved}>
            Your screenshot, context and settings are saved, so trying again starts right where you
            were.
          </p>
          <div className={styles.actions}>
            <Button onClick={onTryAgain}>Try again</Button>
            <ButtonLink variant="secondary" href={changeSettingsHref}>
              Change settings
            </ButtonLink>
          </div>
          <details className={styles.details}>
            <summary className={styles.summary}>Technical details</summary>
            <pre className={styles.pre}>{details}</pre>
          </details>
        </div>
      </div>
    </>
  );
}
