"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { LoadStatus } from "@/components/LoadStatus";
import { ScreenshotViewer } from "@/components/review/ScreenshotViewer";
import { Select } from "@/components/ui";
import { useLoad } from "@/components/useLoad";
import { compareReviews, type CompareResult } from "@/lib/compare";
import { useDataClient } from "@/lib/data/DataClientProvider";
import type { DataClient, Issue, ReviewDetail, Severity } from "@/lib/data/client";
import { isFinished, plural, shortDate, valueChangeText } from "@/lib/format";
import { principleShortName } from "@/lib/principles";
import styles from "./CompareScreen.module.css";

async function loadCompare(client: DataClient, projectId: string, fromId?: string, toId?: string) {
  const [project, checklist] = await Promise.all([
    client.getProject(projectId),
    client.getChecklist(),
  ]);
  const rules = new Map(checklist.rules.map((r) => [r.id, r.text]));
  const finished = project.versions.filter((v) => isFinished(v.reviewStatus) && v.reviewId);
  const from = finished.find((v) => v.id === fromId) ?? finished[1];
  const to = finished.find((v) => v.id === toId) ?? finished[0];
  if (!from || !to) return { project, finished, rules, pair: null };
  const [fromReview, toReview] = await Promise.all([
    client.getReview(from.reviewId!),
    client.getReview(to.reviewId!),
  ]);
  const result =
    from.id === to.id
      ? null
      : compareReviews(
          {
            ...fromReview.version,
            issues: fromReview.issues,
            measurements: fromReview.measurements,
          },
          { ...toReview.version, issues: toReview.issues, measurements: toReview.measurements },
        );
  return { project, finished, rules, pair: { from: fromReview, to: toReview, result } };
}

const SEVERITIES: Severity[] = ["high", "medium", "low"];
const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

/** Screen 5: Compare versions (docs/07). */
export function CompareScreen({
  projectId,
  fromId,
  toId,
}: {
  projectId: string;
  fromId?: string;
  toId?: string;
}) {
  const client = useDataClient();
  const router = useRouter();
  // The picked pair, updated at once so a second change never starts from a stale pair.
  const [picked, setPicked] = useState({ from: fromId, to: toId });
  const { state } = useLoad(
    () => loadCompare(client, projectId, picked.from, picked.to),
    `${projectId} ${picked.from ?? ""} ${picked.to ?? ""}`,
  );

  if (state.status !== "ready") return <LoadStatus state={state} what="project" />;
  const { project, finished, rules, pair } = state.data;

  const crumbs = [
    { label: "Projects", href: "/" },
    { label: project.name, href: `/projects/${project.id}` },
    { label: "Compare" },
  ];

  if (!pair) {
    return (
      <>
        <Breadcrumb items={crumbs} />
        <h1 className={styles.title}>What changed</h1>
        <p className={styles.muted}>
          Comparing needs two reviewed versions. This project has{" "}
          {plural(finished.length, "reviewed version")}.{" "}
          <Link href={`/projects/${project.id}`}>Back to project</Link>
        </p>
      </>
    );
  }

  const { from, to, result } = pair;
  const known = (id?: string) => (finished.some((v) => v.id === id) ? id : undefined);
  const current = {
    from: known(picked.from) ?? from.version.id,
    to: known(picked.to) ?? to.version.id,
  };

  // Versions are newest first: "from" must be older than "to", so the other choices are disabled.
  const position = (versionId: string) => finished.findIndex((v) => v.id === versionId);
  const label = (v: (typeof finished)[number]) =>
    v.reviewedAt ? `${v.name} · ${shortDate(v.reviewedAt)}` : v.name;
  const fromOptions = finished.map((v) => ({
    value: v.id,
    label: label(v),
    disabled: position(v.id) <= position(current.to),
  }));
  const toOptions = finished.map((v) => ({
    value: v.id,
    label: label(v),
    disabled: position(v.id) >= position(current.from),
  }));

  function choose(which: "from" | "to", versionId: string) {
    const next = { ...current, [which]: versionId };
    setPicked(next);
    router.replace(
      `/projects/${encodeURIComponent(project.id)}/compare?from=${encodeURIComponent(next.from)}&to=${encodeURIComponent(next.to)}`,
      { scroll: false },
    );
  }

  return (
    <>
      <Breadcrumb items={crumbs} />
      <div className={styles.header}>
        <h1 className={styles.title}>What changed</h1>
        <div className={styles.pickers}>
          <Select
            label="From"
            options={fromOptions}
            value={current.from}
            onChange={(e) => choose("from", e.target.value)}
          />
          <Select
            label="To"
            options={toOptions}
            value={current.to}
            onChange={(e) => choose("to", e.target.value)}
          />
        </div>
      </div>

      {result === null ? (
        <p className={styles.muted}>Pick two different versions to see what changed.</p>
      ) : (
        <CompareBody from={from} to={to} result={result} rules={rules} />
      )}
    </>
  );
}

function CompareBody({
  from,
  to,
  result,
  rules,
}: {
  from: ReviewDetail;
  to: ReviewDetail;
  result: CompareResult;
  rules: Map<string, string>;
}) {
  const fromName = from.version.name;
  const toName = to.version.name;
  const meta = (issue: Issue) =>
    [
      issue.kind === "measured" ? "Measured" : "Evaluated",
      SEVERITY_LABEL[issue.severity],
      principleShortName(issue.principleId, rules),
    ].join(" · ");
  const counts = (review: ReviewDetail, severity: Severity) =>
    review.issues.filter((i) => i.severity === severity).length;

  return (
    <>
      <ul className={styles.tiles} aria-label="Summary">
        <li className={[styles.tile, styles.tileFixed].join(" ")}>
          <span className={styles.tileLabel}>Fixed</span>
          <span className={styles.tileCount}>{result.fixed.length}</span>
        </li>
        <li className={[styles.tile, styles.tileOpen].join(" ")}>
          <span className={styles.tileLabel}>Still open</span>
          <span className={styles.tileCount}>{result.stillOpen.length}</span>
        </li>
        <li className={[styles.tile, styles.tileNew].join(" ")}>
          <span className={styles.tileLabel}>New in {toName}</span>
          <span className={styles.tileCount}>{result.added.length}</span>
        </li>
      </ul>

      <div className={styles.shots}>
        {[from, to].map((review) => (
          <ScreenshotViewer
            key={review.id}
            src={review.version.screenshotUrl}
            alt={`Screenshot of ${review.version.name}`}
            width={review.version.width}
            height={review.version.height}
            caption={`${review.version.name} · ${plural(review.issues.length, "issue")}`}
          />
        ))}
      </div>

      <div className={styles.lists}>
        <section aria-labelledby="fixed">
          <h2 id="fixed" className={styles.listTitle}>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
              <circle cx="11" cy="11" r="11" className={styles.iconFixed} />
              <path
                d="M6.5 11.2l3 3 6-6.4"
                fill="none"
                className={styles.iconMark}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Fixed
          </h2>
          {result.fixed.length === 0 ? (
            <p className={styles.muted}>Nothing from {fromName} is fixed yet.</p>
          ) : (
            <ul className={styles.items}>
              {result.fixed.map(({ issue, change }) => (
                <li key={issue.id} className={styles.item}>
                  <p className={styles.itemTitle}>{issue.title}</p>
                  <p className={styles.itemMeta}>
                    {change
                      ? `Measured · ${valueChangeText(change.kind, change.before, change.after)}`
                      : meta(issue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="open">
          <h2 id="open" className={styles.listTitle}>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
              <circle
                cx="11"
                cy="11"
                r="10"
                fill="none"
                className={styles.iconOpen}
                strokeWidth="2"
              />
              <path
                d="M7 11h8"
                className={styles.iconOpen}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            Still open
          </h2>
          {result.stillOpen.length === 0 ? (
            <p className={styles.muted}>Nothing from {fromName} is still open.</p>
          ) : (
            <ul className={styles.items}>
              {result.stillOpen.map(({ from: before, to: now }) => (
                <li
                  key={now.id}
                  className={[styles.item, before.pushback ? styles.itemDisagreed : ""].join(" ")}
                >
                  <p className={styles.itemTitle}>{now.title}</p>
                  <p className={styles.itemMeta}>{meta(now)}</p>
                  {before.pushback ? (
                    <p className={styles.itemReason}>
                      <strong>I disagreed in {fromName}:</strong> {before.pushback.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="new">
          <h2 id="new" className={styles.listTitle}>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
              <circle cx="11" cy="11" r="11" className={styles.iconNew} />
              <path
                d="M11 6v6.5"
                className={styles.iconMark}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="11" cy="16" r="1.4" className={styles.iconDot} />
            </svg>
            New in {toName}
          </h2>
          {result.added.length === 0 ? (
            <p className={styles.muted}>No new issues in {toName}.</p>
          ) : (
            <ul className={styles.items}>
              {result.added.map((issue) => (
                <li key={issue.id} className={[styles.item, styles.itemNew].join(" ")}>
                  <p className={styles.itemTitle}>{issue.title}</p>
                  <p className={styles.itemMeta}>{meta(issue)}</p>
                  <Link
                    href={`/reviews/${to.id}?issue=${encodeURIComponent(issue.id)}`}
                    className={styles.itemLink}
                  >
                    Open in {toName} review
                    <span className="visually-hidden">: {issue.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="by-severity" className={styles.severity}>
        <h2 id="by-severity" className={styles.listTitle}>
          By severity
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">{fromName}</th>
                <th scope="col">{toName}</th>
              </tr>
            </thead>
            <tbody>
              {SEVERITIES.map((s) => (
                <tr key={s}>
                  <th scope="row">{SEVERITY_LABEL[s]}</th>
                  <td>{counts(from, s)}</td>
                  <td className={counts(to, s) < counts(from, s) ? styles.better : undefined}>
                    {counts(to, s)}
                  </td>
                </tr>
              ))}
              <tr className={styles.total}>
                <th scope="row">Total</th>
                <td>{from.issues.length}</td>
                <td>{to.issues.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
