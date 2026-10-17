"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Mode } from "@/lib/data/types";
import { DemoPanel } from "./DemoPanel";
import styles from "./Sidebar.module.css";

type NavItem = { href: string; label: string; icon: ReactNode; matches: (path: string) => boolean };

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Projects",
    matches: (p) => p === "/" || p.startsWith("/projects/") || p.startsWith("/reviews/"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        {[
          [2, 2],
          [10, 2],
          [2, 10],
          [10, 10],
        ].map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="6"
            height="6"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        ))}
      </svg>
    ),
  },
  {
    href: "/new",
    label: "New review",
    matches: (p) => p === "/new",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/checklist",
    label: "My checklist",
    matches: (p) => p === "/checklist",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path
          d="M3 4.5l1.5 1.5 3-3M3 11.5l1.5 1.5 3-3M10 5h5M10 12h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

/**
 * aria-current: "page" on the exact page, "true" on the section it belongs to
 * (Project history, Review and Compare highlight Projects, as in the designs).
 */
export function currentFor(item: Pick<NavItem, "href" | "matches">, pathname: string) {
  if (pathname === item.href) return "page" as const;
  return item.matches(pathname) ? ("true" as const) : undefined;
}

export function Sidebar({ mode, sourceLine }: { mode: Mode; sourceLine: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className={styles.sidebar}>
      <Link href="/" className={styles.logo}>
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
          <circle
            cx="14"
            cy="14"
            r="6.5"
            fill="none"
            stroke="var(--color-on-dark)"
            strokeWidth="2.5"
          />
          <path
            d="M19 19l5 5"
            stroke="var(--color-on-dark)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <span className={styles.logoText}>UX Critic</span>
      </Link>
      <ul className={styles.list}>
        {NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={currentFor(item, pathname)}
              className={styles.link}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      {mode === "demo" ? (
        <DemoPanel sourceLine={sourceLine} />
      ) : (
        <p className={styles.note}>Private · runs on this laptop</p>
      )}
    </nav>
  );
}
