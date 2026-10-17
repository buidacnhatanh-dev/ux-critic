import Link from "next/link";
import type { LoadState } from "./useLoad";
import styles from "./LoadStatus.module.css";

/** Loading, not found and error states shared by the data screens. */
export function LoadStatus({ state, what }: { state: LoadState<unknown>; what: string }) {
  if (state.status === "loading") {
    return <p className={styles.note}>Loading {what}…</p>;
  }
  if (state.status === "not-found") {
    return (
      <>
        <h1 className={styles.title}>{capitalise(what)} not found</h1>
        <p className={styles.note}>
          It may have been deleted. <Link href="/">Go to Projects</Link>
        </p>
      </>
    );
  }
  if (state.status === "error") {
    return (
      <>
        <h1 className={styles.title}>Could not load the {what}</h1>
        <p className={styles.note}>{state.message}</p>
      </>
    );
  }
  return null;
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
