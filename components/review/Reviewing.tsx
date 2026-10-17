"use client";

import { useEffect, useRef } from "react";
import { Breadcrumb, type Crumb } from "@/components/Breadcrumb";
import { Button, useAnnouncer } from "@/components/ui";
import type { ReviewDetail, ReviewStep } from "@/lib/data/types";
import { STEP_LABEL, STEPS, stepDetail, stepState } from "@/lib/reviewing";
import { ScreenshotViewer } from "./ScreenshotViewer";
import styles from "./Reviewing.module.css";

const STEP_ACTIVE: Record<ReviewStep, string> = {
  prepare: "loading the screenshot",
  measure: "measuring contrast and sizes",
  evaluate: "evaluating against principles",
  place: "placing notes on the screenshot",
};

/** Screen 9: a review that is queued or running. The parent polls every second. */
export function Reviewing({
  review,
  crumbs,
  onCancel,
  demo,
}: {
  review: ReviewDetail;
  crumbs: Crumb[];
  onCancel?: () => void;
  demo: boolean;
}) {
  const { announce } = useAnnouncer();
  const previous = useRef<ReviewStep>(review.step);

  // Announce each finished step politely (docs/06 §9).
  useEffect(() => {
    const before = STEPS.indexOf(previous.current);
    const now = STEPS.indexOf(review.step);
    if (now > before) {
      announce(`${STEP_LABEL[previous.current]}. Now ${STEP_ACTIVE[review.step]}.`);
    }
    previous.current = review.step;
  }, [review.step, announce]);

  return (
    <>
      <Breadcrumb items={crumbs} />
      <h1 className={styles.title}>Reviewing {review.version.name}…</h1>
      <div className={styles.columns}>
        <div className={styles.shot}>
          <ScreenshotViewer
            src={review.version.screenshotUrl}
            alt={`Screenshot of ${review.projectName} ${review.version.name}, being reviewed`}
            width={review.version.width}
            height={review.version.height}
            overlay={<span className={styles.scan} aria-hidden="true" />}
          />
        </div>
        <div className={styles.side}>
          <ol className={styles.steps}>
            {STEPS.map((step) => {
              const state = stepState(step, review.step, false);
              const detail = stepDetail(step, review, state);
              return (
                <li key={step} className={styles.step} data-state={state}>
                  <span className={styles.icon} aria-hidden="true">
                    {state === "done" ? (
                      <svg width="24" height="24" viewBox="0 0 22 22" focusable="false">
                        <circle cx="11" cy="11" r="11" className={styles.doneCircle} />
                        <path
                          d="M6.5 11.2l3 3 6-6.4"
                          fill="none"
                          className={styles.doneMark}
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : state === "current" ? (
                      <span className={styles.spinner} />
                    ) : (
                      <span className={styles.waiting} />
                    )}
                  </span>
                  <span className={styles.stepText}>
                    <span className={styles.stepLabel}>
                      {STEP_LABEL[step]}
                      <span className="visually-hidden">
                        {state === "done"
                          ? ", done"
                          : state === "current"
                            ? ", in progress"
                            : ", waiting"}
                      </span>
                    </span>
                    {detail ? <span className={styles.stepDetail}>{detail}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className={styles.note}>
            {demo
              ? "The demo replays a prepared review in about 6 seconds. Nothing is sent to Claude."
              : "Usually 15 to 30 seconds. Measured results are already saved, even if you leave."}
          </p>
          {onCancel ? (
            <Button variant="secondary" onClick={onCancel} className={styles.cancel}>
              Cancel review
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
