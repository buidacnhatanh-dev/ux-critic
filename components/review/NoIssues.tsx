import Link from "next/link";
import { Breadcrumb, type Crumb } from "@/components/Breadcrumb";
import { ButtonLink } from "@/components/ui";
import type { ReviewDetail } from "@/lib/data/types";
import { checkedAgainst, plural } from "@/lib/format";
import { ScreenshotViewer } from "./ScreenshotViewer";
import styles from "./NoIssues.module.css";

/** Screen 12: a finished review with no issues. */
export function NoIssues({
  review,
  crumbs,
  compare,
  fixedSincePrevious,
}: {
  review: ReviewDetail;
  crumbs: Crumb[];
  compare: { href: string; name: string } | null;
  fixedSincePrevious: { count: number; name: string } | null;
}) {
  const ruleCount = review.sources.sets.mine ? review.sources.ruleIds.length : 0;
  return (
    <>
      <Breadcrumb items={crumbs} />
      <h1 className={styles.title}>Review of {review.version.name}</h1>
      <div className={styles.columns}>
        <div className={styles.shot}>
          <ScreenshotViewer
            src={review.version.screenshotUrl}
            alt={`Screenshot of ${review.projectName} ${review.version.name}, with no marked problems`}
            width={review.version.width}
            height={review.version.height}
          />
        </div>
        <div className={styles.side}>
          <section aria-labelledby="no-issues" className={styles.card}>
            <svg width="44" height="44" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
              <circle cx="11" cy="11" r="11" className={styles.checkCircle} />
              <path
                d="M6.5 11.2l3 3 6-6.4"
                fill="none"
                className={styles.checkMark}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 id="no-issues" className={styles.cardTitle}>
              No issues found
            </h2>
            <p className={styles.checked}>
              Checked against {checkedAgainst(review.sources.sets, ruleCount)}.
            </p>
            <p className={styles.honest}>
              That doesn&apos;t mean there are no problems. An evaluation can miss things, so
              watching one real person use it is still worth it.
            </p>
          </section>
          <div className={styles.actions}>
            {compare ? (
              <ButtonLink href={compare.href}>Compare with {compare.name}</ButtonLink>
            ) : null}
            <ButtonLink
              variant={compare ? "secondary" : "primary"}
              href={`/projects/${review.projectId}`}
            >
              Back to project
            </ButtonLink>
          </div>
          {fixedSincePrevious && compare ? (
            <p className={styles.fixed}>
              Fixed since {fixedSincePrevious.name}: {plural(fixedSincePrevious.count, "issue")}.{" "}
              <Link href={compare.href}>See what changed</Link>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
