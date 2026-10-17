import type { Metadata } from "next";
import Link from "next/link";
import styles from "./states.module.css";

export const metadata: Metadata = { title: "Screen states", robots: { index: false } };

const STATES: { href: string; title: string; text: string }[] = [
  {
    href: "/states/setup",
    title: "Connect Claude",
    text: "Shown on the laptop when no API key is set, with the three steps to add one.",
  },
  {
    href: "/states/failed",
    title: "Review failed",
    text: "Claude did not answer in time. The screenshot and measured results are kept.",
  },
  {
    href: "/states/partial",
    title: "Evaluation unreadable",
    text: "Measured results are ready, but the evaluation came back in a format the app couldn't read.",
  },
  {
    href: "/states/upload",
    title: "Upload and form errors",
    text: "The live New review form with paste, Scale and its error summary. Nothing is uploaded.",
  },
];

/** docs/10: states the public demo can't reach, with sample data. Linked from the demo dialog. */
export default function StatesPage() {
  return (
    <>
      <h1>Screen states</h1>
      <p className={styles.lead}>
        The online demo never calls Claude, so some screens can&apos;t happen here. These pages show
        them with sample data made from the prepared reviews.
      </p>
      <ul className={styles.list}>
        {STATES.map((state) => (
          <li key={state.href} className={styles.item}>
            <Link href={state.href} className={styles.link}>
              {state.title}
            </Link>
            <p className={styles.text}>{state.text}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
