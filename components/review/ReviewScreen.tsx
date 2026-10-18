"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { LoadStatus } from "@/components/LoadStatus";
import { Button, ButtonLink, useAnnouncer, useToast } from "@/components/ui";
import { useLoad } from "@/components/useLoad";
import { compareReviews } from "@/lib/compare";
import { useDataClient } from "@/lib/data/DataClientProvider";
import type { DataClient, Issue, ReviewDetail, VersionSummary } from "@/lib/data/client";
import { isFinished, plural, reviewSummary } from "@/lib/format";
import { principleName } from "@/lib/principles";
import { IssueCard } from "./IssueCard";
import { NoIssues } from "./NoIssues";
import { ReviewFailed } from "./ReviewFailed";
import { Reviewing } from "./Reviewing";
import { ScreenshotViewer } from "./ScreenshotViewer";
import styles from "./ReviewScreen.module.css";

export type Filter = "all" | "measured" | "evaluated";

/** The version to compare with: the previous finished one, else the next. Null when none. */
function compareTarget(versions: VersionSummary[], versionId: string) {
  const index = versions.findIndex((v) => v.id === versionId);
  const older = versions.slice(index + 1).find((v) => isFinished(v.reviewStatus));
  if (older) return { other: older, from: older.id, to: versionId };
  const newer = versions
    .slice(0, Math.max(index, 0))
    .reverse()
    .find((v) => isFinished(v.reviewStatus));
  if (newer) return { other: newer, from: versionId, to: newer.id };
  return null;
}

async function loadReview(client: DataClient, id: string) {
  const review = await client.getReview(id);
  const [project, checklist] = await Promise.all([
    client.getProject(review.projectId),
    client.getChecklist(),
  ]);
  const target = compareTarget(project.versions, review.version.id);
  // No issues found shows "Fixed since v<n>", which needs the previous review.
  let fixedSincePrevious: number | null = null;
  if (
    review.issues.length === 0 &&
    target &&
    target.to === review.version.id &&
    target.other.reviewId
  ) {
    const previous = await client.getReview(target.other.reviewId);
    fixedSincePrevious = compareReviews(
      { ...previous.version, issues: previous.issues, measurements: previous.measurements },
      { ...review.version, issues: review.issues, measurements: review.measurements },
    ).fixed.length;
  }
  return {
    review,
    target,
    fixedSincePrevious,
    rules: new Map(checklist.rules.map((r) => [r.id, r.text])),
  };
}

/** New review, filled in with what this review used (Cancel review, Change settings). */
export function newReviewHref(review: ReviewDetail): string {
  const params = new URLSearchParams({
    project: review.projectId,
    projectName: review.projectName,
    version: review.version.name,
  });
  if (review.version.context) params.set("context", review.version.context);
  if (review.sampleId) params.set("sample", review.sampleId);
  return `/new?${params.toString()}`;
}

/**
 * /reviews/[id]: Reviewing (9) while it runs, Review failed (10), Review (4) with the partial
 * state (11), and No issues found (12).
 */
export function ReviewScreen({ id, initialIssueId }: { id: string; initialIssueId?: string }) {
  const client = useDataClient();
  const router = useRouter();
  const { announce } = useAnnouncer();
  const { showToast } = useToast();
  const { state, reload } = useLoad(() => loadReview(client, id), id);
  const running =
    state.status === "ready" &&
    (state.data.review.status === "queued" || state.data.review.status === "running");

  // Poll every second while the review runs, then switch to the result (docs/06 §9).
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(reload, 1000);
    return () => clearInterval(timer);
  }, [running, reload]);

  const wasRunning = useRef(false);
  useEffect(() => {
    if (state.status !== "ready") return;
    const { review } = state.data;
    if (wasRunning.current && !running) {
      announce(
        review.status === "failed"
          ? "The review didn't finish."
          : `Review finished. ${plural(review.issues.length, "issue")} found.`,
      );
    }
    wasRunning.current = running;
  }, [state, running, announce]);

  if (state.status !== "ready") return <LoadStatus state={state} what="review" />;
  const { review, target, fixedSincePrevious, rules } = state.data;

  const crumbs = [
    { label: "Projects", href: "/" },
    { label: review.projectName, href: `/projects/${review.projectId}` },
    { label: review.version.name },
  ];
  const compareHref = target
    ? `/projects/${review.projectId}/compare?from=${target.from}&to=${target.to}`
    : null;

  if (running) {
    return (
      <Reviewing
        review={review}
        crumbs={crumbs}
        demo={client.mode === "demo"}
        onCancel={async () => {
          await client.cancelReview(review.id);
          announce("Review cancelled. The form is filled in again.");
          router.push(newReviewHref(review));
        }}
      />
    );
  }

  if (review.status === "failed") {
    return (
      <ReviewFailed
        review={review}
        crumbs={crumbs}
        changeSettingsHref={newReviewHref(review)}
        onTryAgain={async () => {
          // Live: a new review of the stored screenshot (docs/03). Demo samples: the filled in form.
          if (!client.restartReview) return router.push(newReviewHref(review));
          try {
            const { reviewId } = await client.restartReview(review.id);
            announce("Starting the review again.");
            router.push(`/reviews/${reviewId}`);
          } catch (error) {
            showToast({ message: error instanceof Error ? error.message : String(error) });
          }
        }}
      />
    );
  }

  if (review.issues.length === 0 && review.status === "done" && !review.evaluationOff) {
    return (
      <NoIssues
        review={review}
        crumbs={crumbs}
        compare={compareHref && target ? { href: compareHref, name: target.other.name } : null}
        fixedSincePrevious={
          fixedSincePrevious !== null && target
            ? { count: fixedSincePrevious, name: target.other.name }
            : null
        }
      />
    );
  }

  return (
    <ReviewDone
      key={review.id}
      review={review}
      crumbs={crumbs}
      compare={compareHref && target ? { href: compareHref, name: target.other.name } : null}
      rules={rules}
      initialIssueId={initialIssueId}
      onSetPushback={async (issueId, reason) => {
        await client.setPushback(issueId, reason);
        await reload();
      }}
      onRetryEvaluation={async () => {
        try {
          await client.retryEvaluation(review.id);
          await reload();
        } catch (error) {
          showToast({ message: error instanceof Error ? error.message : String(error) });
        }
      }}
    />
  );
}

/** Screen 4, and screen 11 when the status is partial. */
export function ReviewDone({
  review,
  crumbs,
  compare,
  rules,
  initialIssueId,
  onSetPushback,
  onRetryEvaluation,
}: {
  review: ReviewDetail;
  crumbs: { label: string; href?: string }[];
  compare: { href: string; name: string } | null;
  rules: Map<string, string>;
  initialIssueId?: string;
  onSetPushback: (issueId: string, reason: string | null) => Promise<void>;
  onRetryEvaluation: () => Promise<void>;
}) {
  const { announce } = useAnnouncer();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    review.issues.some((i) => i.id === initialIssueId) ? initialIssueId! : null,
  );
  const headerRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusCard = useRef<string | null>(null);

  const counts = useMemo(
    () => ({
      all: review.issues.length,
      measured: review.issues.filter((i) => i.kind === "measured").length,
      evaluated: review.issues.filter((i) => i.kind === "evaluated").length,
    }),
    [review.issues],
  );
  const visible = review.issues.filter((i) => filter === "all" || i.kind === filter);
  const pushbackCount = review.issues.filter((i) => i.pushback).length;

  // Selecting by region badge moves focus to the card, so keyboard users land on it.
  useEffect(() => {
    const id = focusCard.current;
    if (!id) return;
    focusCard.current = null;
    const header = headerRefs.current.get(id);
    header?.focus();
    header?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Opening with ?issue= scrolls that card into view.
  useEffect(() => {
    if (initialIssueId) headerRefs.current.get(initialIssueId)?.scrollIntoView({ block: "center" });
  }, [initialIssueId]);

  const setHeaderRef = useCallback(
    (id: string) => (element: HTMLButtonElement | null) => {
      if (element) headerRefs.current.set(id, element);
      else headerRefs.current.delete(id);
    },
    [],
  );

  function chooseFilter(next: Filter) {
    setFilter(next);
    const selected = review.issues.find((i) => i.id === selectedId);
    if (selected && next !== "all" && selected.kind !== next) setSelectedId(null);
    const count = counts[next];
    announce(
      next === "all"
        ? `Showing all ${plural(count, "issue")}`
        : `Showing ${plural(count, `${next} issue`)}`,
    );
  }

  function selectFromRegion(issueId: string) {
    focusCard.current = issueId;
    setSelectedId(issueId);
    const issue = review.issues.find((i) => i.id === issueId);
    if (issue) announce(`Issue ${issue.number} selected: ${issue.title}`);
  }

  async function saveReason(issue: Issue, reason: string) {
    await onSetPushback(issue.id, reason);
    announce(`Reason saved. Issue ${issue.number} is marked I disagreed.`);
  }

  async function undoReason(issue: Issue) {
    await onSetPushback(issue.id, null);
    announce(`Reason removed. Issue ${issue.number} is open again.`);
  }

  return (
    <>
      <Breadcrumb items={crumbs} />
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Review of {review.version.name}</h1>
          <p className={styles.summary}>
            {reviewSummary(review.issues.length, pushbackCount, review.finishedAt)}
          </p>
          {/* The model from the API response: after a fallback it is not the one requested. */}
          {review.model ? <p className={styles.summary}>Evaluated by {review.model}</p> : null}
        </div>
        <div className={styles.tools}>
          <div role="group" aria-label="Filter issues" className={styles.filters}>
            {(["all", "measured", "evaluated"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                className={styles.filter}
                onClick={() => chooseFilter(f)}
              >
                {f === "all" ? "All" : f === "measured" ? "Measured" : "Evaluated"} {counts[f]}
              </button>
            ))}
          </div>
          {compare ? (
            <ButtonLink variant="secondary" href={compare.href} className={styles.compare}>
              Compare with {compare.name}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {review.evaluationOff ? (
        <p className={styles.evaluationOff}>
          Evaluation is off. <Link href="/setup">Connect Claude</Link> to turn it on.
        </p>
      ) : null}

      {review.status === "partial" ? (
        <div className={styles.banner}>
          <span className={styles.bannerIcon} aria-hidden="true">
            !
          </span>
          <p className={styles.bannerText}>
            <strong>Measured results are ready.</strong> The evaluation came back in a format the
            app couldn&apos;t read, so it isn&apos;t shown.
          </p>
          <Button className={styles.retry} onClick={onRetryEvaluation}>
            Retry evaluation
          </Button>
        </div>
      ) : null}

      <div className={styles.columns}>
        <div className={styles.shot}>
          <ScreenshotViewer
            src={review.version.screenshotUrl}
            alt={`Screenshot of ${review.projectName} ${review.version.name}, with numbered problem areas`}
            width={review.version.width}
            height={review.version.height}
            issues={visible}
            selectedId={selectedId}
            onSelect={selectFromRegion}
            caption="Highlighted areas are approximate. Select an issue to see where it is."
          />
        </div>
        <section aria-labelledby="issues-title" className={styles.list}>
          <h2 id="issues-title" className="visually-hidden">
            Issues
          </h2>
          {visible.length === 0 ? (
            <p className={styles.summary}>
              {filter === "all"
                ? "No issues in this review."
                : `No ${filter} issues in this review.`}
            </p>
          ) : (
            visible.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                principle={principleName(issue.principleId, rules)}
                expanded={issue.id === selectedId}
                onToggle={() =>
                  setSelectedId((current) => (current === issue.id ? null : issue.id))
                }
                onPushback={(reason) => saveReason(issue, reason)}
                onUndoPushback={() => undoReason(issue)}
                headerRef={setHeaderRef(issue.id)}
              />
            ))
          )}
          {review.status === "partial" && filter !== "measured" ? (
            <div className={styles.missing}>
              <p className={styles.missingTitle}>Evaluation missing</p>
              <p className={styles.missingText}>
                Heuristics, Laws of UX and your own rules will appear here after a retry.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
