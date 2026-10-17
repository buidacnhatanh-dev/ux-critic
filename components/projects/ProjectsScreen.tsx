"use client";

import Link from "next/link";
import { LoadStatus } from "@/components/LoadStatus";
import { SeverityCounts } from "@/components/SeverityCounts";
import { ButtonLink, useToast } from "@/components/ui";
import { useLoad } from "@/components/useLoad";
import { useDataClient } from "@/lib/data/DataClientProvider";
import type { DataClient, ProjectSummary } from "@/lib/data/client";
import { shortDate, trend } from "@/lib/format";
import { FirstUse } from "./FirstUse";
import styles from "./ProjectsScreen.module.css";

type RecentReview = {
  reviewId: string;
  reviewedAt: string;
  projectName: string;
  versionName: string;
  issueCount: number;
  pushbackCount: number;
};

const RECENT_LIMIT = 10;

async function loadProjects(client: DataClient) {
  const projects = await client.listProjects();
  const details = await Promise.all(projects.map((p) => client.getProject(p.id)));
  const recent: RecentReview[] = details
    .flatMap((project) =>
      project.versions.flatMap((v) =>
        v.reviewId && v.reviewedAt
          ? [
              {
                reviewId: v.reviewId,
                reviewedAt: v.reviewedAt,
                projectName: project.name,
                versionName: v.name,
                issueCount: v.issueCount,
                pushbackCount: v.pushbackCount,
              },
            ]
          : [],
      ),
    )
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .slice(0, RECENT_LIMIT);
  return { projects, recent };
}

const plusIcon = (
  <svg width="16" height="16" viewBox="0 0 18 18" focusable="false">
    <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Screen 1: Projects, or screen 7 (First use) when there are none. */
export function ProjectsScreen() {
  const client = useDataClient();
  const { showToast } = useToast();
  const { state, reload } = useLoad(() => loadProjects(client), "projects");

  if (state.status !== "ready") return <LoadStatus state={state} what="projects" />;
  const { projects, recent } = state.data;

  if (projects.length === 0) {
    const resetDemo = client.resetDemo;
    return (
      <FirstUse
        onResetDemo={
          resetDemo
            ? async () => {
                await resetDemo();
                await reload();
                showToast({ message: "Demo reset. The sample projects are back." });
              }
            : undefined
        }
      />
    );
  }

  return (
    <>
      <div className={styles.header}>
        <h1>Projects</h1>
        <ButtonLink href="/new" icon={plusIcon} className={styles.newReview}>
          New review
        </ButtonLink>
      </div>

      <ul className={styles.grid}>
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} />
          </li>
        ))}
        <li>
          <Link href="/new?project=new" className={styles.addCard}>
            <svg width="28" height="28" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path
                d="M9 3v12M3 9h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Add a project
          </Link>
        </li>
      </ul>

      <section aria-labelledby="recent-reviews" className={styles.recent}>
        <h2 id="recent-reviews" className={styles.recentTitle}>
          Recent reviews
        </h2>
        {recent.length === 0 ? (
          <p className={styles.muted}>No finished reviews yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Project</th>
                  <th scope="col">Version</th>
                  <th scope="col">Issues</th>
                  <th scope="col">I disagreed</th>
                  <th scope="col">
                    <span className="visually-hidden">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.reviewId}>
                    <td>{shortDate(row.reviewedAt)}</td>
                    <td>{row.projectName}</td>
                    <td>{row.versionName}</td>
                    <td>{row.issueCount}</td>
                    <td>{row.pushbackCount}</td>
                    <td>
                      <Link href={`/reviews/${row.reviewId}`} className={styles.open}>
                        Open
                        <span className="visually-hidden">
                          {" "}
                          review of {row.projectName} {row.versionName}
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const latest = project.latestVersion;
  const total = project.counts
    ? project.counts.high + project.counts.medium + project.counts.low
    : null;
  const line =
    total !== null && project.previousIssueCount !== null && project.previousVersionName
      ? trend(total, project.previousIssueCount, project.previousVersionName)
      : null;

  return (
    <Link href={`/projects/${project.id}`} className={styles.card}>
      <div className={styles.thumb}>
        {latest ? (
          // eslint-disable-next-line @next/next/no-img-element -- screenshots are shown as they are
          <img src={latest.thumbnailUrl} alt="" className={styles.thumbImage} />
        ) : null}
      </div>
      <div className={styles.cardBody}>
        <div>
          <h2 className={styles.cardTitle}>{project.name}</h2>
          {latest ? (
            <span className={styles.meta}>
              {latest.name}
              {latest.reviewedAt
                ? ` · reviewed ${shortDate(latest.reviewedAt)}`
                : " · review running"}
            </span>
          ) : (
            <span className={styles.meta}>No versions yet</span>
          )}
        </div>
        {project.counts ? <SeverityCounts counts={project.counts} /> : null}
        {line ? (
          <span className={styles[line.tone]}>{line.text}</span>
        ) : project.versionCount === 1 && project.counts ? (
          <span className={styles.meta}>First review</span>
        ) : null}
      </div>
    </Link>
  );
}
