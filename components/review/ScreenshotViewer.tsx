"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Issue } from "@/lib/data/types";
import { badgePlacements, regionPosition } from "@/lib/regions";
import styles from "./ScreenshotViewer.module.css";

export type ScreenshotViewerProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Issues to mark, in number order. Issues without a region (whole screen) get no box. */
  issues?: Issue[];
  selectedId?: string | null;
  onSelect?: (issueId: string) => void;
  caption?: string;
  /** Drawn over the image, for example the scan line while reviewing. */
  overlay?: ReactNode;
};

function regionTone(issue: Issue) {
  if (issue.pushback) return "pushedBack";
  return issue.kind;
}

/**
 * The screenshot scaled to its column with region boxes positioned in percentages.
 * Number badges are buttons that select their issue card.
 */
export function ScreenshotViewer({
  src,
  alt,
  width,
  height,
  issues = [],
  selectedId = null,
  onSelect,
  caption,
  overlay,
}: ScreenshotViewerProps) {
  const marked = issues.filter((issue) => issue.region);
  const badges = badgePlacements(
    marked.map((i) => i.region),
    width,
  );

  return (
    <figure className={styles.frame}>
      <div className={styles.canvas} style={{ aspectRatio: `${width} / ${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- regions are placed on the exact image */}
        <img src={src} alt={alt} width={width} height={height} className={styles.image} />
        {marked.map((issue, index) => {
          const selected = issue.id === selectedId;
          return (
            <div
              key={issue.id}
              className={[
                styles.region,
                styles[regionTone(issue)],
                selected ? styles.selected : "",
              ].join(" ")}
              style={regionPosition(issue.region!, width, height)}
              data-issue-number={issue.number}
              data-selected={selected ? "true" : undefined}
            >
              <button
                type="button"
                className={styles.badge}
                style={
                  {
                    "--badge-offset": badges[index]!.offset,
                    ...(badges[index]!.anchor
                      ? {
                          left: `calc(${badges[index]!.anchor!.left} - 22px)`,
                          top: `calc(${badges[index]!.anchor!.top} - 22px)`,
                        }
                      : {}),
                  } as CSSProperties
                }
                aria-label={`Issue ${issue.number}: ${issue.title}`}
                aria-pressed={selected}
                onClick={() => onSelect?.(issue.id)}
              >
                <span className={styles.badgeDot} aria-hidden="true">
                  {issue.number}
                </span>
              </button>
            </div>
          );
        })}
        {overlay}
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}
