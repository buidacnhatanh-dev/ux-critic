"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { LoadStatus } from "@/components/LoadStatus";
import { SeverityCounts } from "@/components/SeverityCounts";
import { Button, ButtonLink, Dialog, Tooltip, useToast } from "@/components/ui";
import { useLoad } from "@/components/useLoad";
import { useDataClient } from "@/lib/data/DataClientProvider";
import type { DataClient, Issue, ProjectDetail, VersionSummary } from "@/lib/data/client";
import { isFinished, plural, shortDate } from "@/lib/format";
import { principleShortName } from "@/lib/principles";
import styles from "./ProjectHistory.module.css";

type Disagreement = { issue: Issue; versionName: string };

async function loadHistory(client: DataClient, id: string) {
  const [project, checklist] = await Promise.all([client.getProject(id), client.getChecklist()]);
  const reviews = await Promise.all(
    project.versions.map((v) => (v.reviewId ? client.getReview(v.reviewId) : null)),
  );
  const disagreements: Disagreement[] = reviews.flatMap((review) =>
    review
      ? review.issues
          .filter((issue) => issue.pushback)
          .map((issue) => ({ issue, versionName: review.version.name }))
      : [],
  );
  const rules = new Map(checklist.rules.map((r) => [r.id, r.text]));
  return { project, disagreements, rules };
}

const trashIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" focusable="false">
    <path
      d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Screen 2: Project history, with screen 15 (Delete a project). */
export function ProjectHistory({ id }: { id: string }) {
  const client = useDataClient();
  const { state } = useLoad(() => loadHistory(client, id), id);

  if (state.status !== "ready") return <LoadStatus state={state} what="project" />;
  const { project, disagreements, rules } = state.data;
  const [latest] = project.versions;
  const finished = project.versions.filter((v) => isFinished(v.reviewStatus));
  const [newestFinished, secondFinished] = finished;

  return (
    <>
      <Breadcrumb items={[{ label: "Projects", href: "/" }, { label: project.name }]} />
      <div className={styles.header}>
        <h1>{project.name}</h1>
        <div className={styles.actions}>
          {newestFinished && secondFinished ? (
            <ButtonLink
              variant="secondary"
              href={`/projects/${project.id}/compare?from=${secondFinished.id}&to=${newestFinished.id}`}
            >
              Compare {secondFinished.name} and {newestFinished.name}
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/new?project=${encodeURIComponent(project.id)}`}>
            Review a new version
          </ButtonLink>
          <DeleteProject project={project} disagreementCount={disagreements.length} />
        </div>
      </div>

      <div className={styles.columns}>
        <section aria-labelledby="versions" className={styles.versions}>
          <h2 id="versions" className={styles.sectionTitle}>
            Versions
          </h2>
          {project.versions.length === 0 ? (
            <p className={styles.muted}>No versions yet.</p>
          ) : (
            <ul className={styles.versionList}>
              {project.versions.map((version) => (
                <li key={version.id}>
                  <VersionCard version={version} latest={version === latest} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className={styles.aside} aria-label="Project summary">
          <IssuesPerVersion versions={[...finished].reverse()} />
          <section aria-labelledby="disagreed" className={styles.panel}>
            <h2 id="disagreed" className={styles.panelTitle}>
              Where I disagreed
            </h2>
            <p className={styles.panelLead}>My reasons, kept with every review.</p>
            {disagreements.length === 0 ? (
              <p className={styles.muted}>
                No reasons yet. When you disagree with a note, your reason shows here.
              </p>
            ) : (
              <ul className={styles.reasons}>
                {disagreements.map(({ issue, versionName }) => (
                  <li key={issue.id} className={styles.reason}>
                    <p className={styles.reasonTitle}>{issue.title}</p>
                    <p className={styles.reasonMeta}>
                      {versionName} · {principleShortName(issue.principleId, rules)} ·{" "}
                      {issue.kind === "measured"
                        ? "Measured"
                        : `Confidence: ${issue.confidence ?? "not given"}`}
                    </p>
                    <blockquote className={styles.quote}>
                      <p>“{issue.pushback?.reason}”</p>
                    </blockquote>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function VersionCard({ version, latest }: { version: VersionSummary; latest: boolean }) {
  const running = version.reviewStatus === "queued" || version.reviewStatus === "running";
  return (
    <article className={[styles.version, latest ? styles.latest : ""].join(" ")}>
      <div className={styles.versionThumb} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- screenshots are shown as they are */}
        <img src={version.screenshotUrl} alt="" className={styles.versionImage} />
      </div>
      <div className={styles.versionBody}>
        <div className={styles.versionHead}>
          <h3 className={styles.versionName}>{version.name}</h3>
          {latest ? <span className={styles.latestPill}>Latest</span> : null}
          <span className={styles.muted}>
            {version.reviewedAt
              ? `Reviewed ${shortDate(version.reviewedAt)}`
              : running
                ? "Review running"
                : version.reviewStatus === "failed"
                  ? "Review failed"
                  : "Not reviewed"}
          </span>
        </div>
        {version.context ? <p className={styles.context}>{version.context}</p> : null}
        {version.counts ? <SeverityCounts counts={version.counts} /> : null}
        {version.reviewId ? (
          <Link href={`/reviews/${version.reviewId}`} className={styles.openReview}>
            Open review<span className="visually-hidden"> of {version.name}</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function IssuesPerVersion({ versions }: { versions: VersionSummary[] }) {
  const max = Math.max(1, ...versions.map((v) => v.issueCount));
  return (
    <section aria-labelledby="per-version" className={styles.panel}>
      <h2 id="per-version" className={styles.panelTitle}>
        Issues per version
      </h2>
      {versions.length === 0 ? (
        <p className={styles.muted}>No finished reviews yet.</p>
      ) : (
        <>
          <ul className={styles.bars}>
            {versions.map((v) => {
              const counts = v.counts ?? { high: 0, medium: 0, low: 0 };
              return (
                <li key={v.id} className={styles.barRow}>
                  <span className={styles.barName}>{v.name}</span>
                  <span className={styles.bar} aria-hidden="true">
                    {(["high", "medium", "low"] as const).map((s) =>
                      counts[s] > 0 ? (
                        <span
                          key={s}
                          className={styles[`bar_${s}`]}
                          style={{ width: `${(counts[s] / max) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </span>
                  <span className={styles.barTotal}>
                    {v.issueCount}
                    <span className="visually-hidden">
                      {" "}
                      {v.issueCount === 1 ? "issue" : "issues"}: High {counts.high}, Medium{" "}
                      {counts.medium}, Low {counts.low}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={styles.bar_high} />
              High
            </span>
            <span className={styles.legendItem}>
              <span className={styles.bar_medium} />
              Medium
            </span>
            <span className={styles.legendItem}>
              <span className={styles.bar_low} />
              Low
            </span>
          </p>
        </>
      )}
    </section>
  );
}

function DeleteProject({
  project,
  disagreementCount,
}: {
  project: ProjectDetail;
  disagreementCount: number;
}) {
  const client = useDataClient();
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const reviewCount = project.versions.filter((v) => v.reviewId).length;
  const screenshotCount = project.versions.length;

  async function remove() {
    await client.deleteProject(project.id);
    setOpen(false);
    showToast({ message: `Deleted ${project.name}` });
    router.push("/");
  }

  return (
    <>
      <Tooltip content="Delete project">
        <Button
          variant="secondary"
          className={styles.iconButton}
          aria-label="Delete project"
          onClick={() => setOpen(true)}
        >
          {trashIcon}
        </Button>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete “${project.name}”?`}
        role="alertdialog"
        initialFocus={keepRef}
        footer={
          <>
            <Button ref={keepRef} variant="secondary" onClick={() => setOpen(false)}>
              Keep project
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete project
            </Button>
          </>
        }
      >
        <p>This deletes everything saved for this project:</p>
        <ul>
          <li>
            {plural(reviewCount, "review")} and{" "}
            {screenshotCount === 1 ? "its screenshot" : `${screenshotCount} screenshots`}
          </li>
          <li>{plural(disagreementCount, "reason")} you wrote when you disagreed</li>
        </ul>
        <p className={styles.warning}>You can&apos;t undo this.</p>
      </Dialog>
    </>
  );
}
