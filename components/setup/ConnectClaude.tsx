"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import styles from "./ConnectClaude.module.css";

/** docs/03: the owner's choice to run without evaluation, read by the server in live mode. */
export const MEASURED_ONLY_COOKIE = "uxc-measured-only";

/** Screen 8: shown when the API key is missing. */
export function ConnectClaude({ sample = false }: { sample?: boolean }) {
  const router = useRouter();
  return (
    <div className={styles.card}>
      <p className={styles.status}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.9" fill="currentColor" />
        </svg>
        No API key found
      </p>
      <h1 className={styles.title}>Connect Claude to start reviewing</h1>
      <p className={styles.lead}>
        Measured checks work without it. The evaluation needs your own Claude API key, which stays
        on this laptop.
      </p>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.number} aria-hidden="true">
            1
          </span>
          <div>
            <p className={styles.stepTitle}>Create a key</p>
            <p className={styles.stepText}>
              On <a href="https://platform.claude.com">platform.claude.com</a>, open API keys. Set a
              monthly spending limit while you are there.
            </p>
          </div>
        </li>
        <li className={styles.step}>
          <span className={styles.number} aria-hidden="true">
            2
          </span>
          <div>
            <p className={styles.stepTitle}>Add it to the project</p>
            <p className={styles.stepText}>
              Create a file called <code className={styles.code}>.env.local</code> with this line:
            </p>
            <pre className={styles.pre}>ANTHROPIC_API_KEY=your-key-here</pre>
          </div>
        </li>
        <li className={styles.step}>
          <span className={styles.number} aria-hidden="true">
            3
          </span>
          <div>
            <p className={styles.stepTitle}>Restart the app</p>
            <p className={styles.stepText}>
              Stop it and run <code className={styles.code}>pnpm dev</code> again.
            </p>
          </div>
        </li>
      </ol>
      <div className={styles.actions}>
        <Button onClick={() => window.location.reload()}>Check again</Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (!sample) {
              document.cookie = `${MEASURED_ONLY_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
            }
            router.push("/");
          }}
        >
          Continue with measured checks only
        </Button>
      </div>
    </div>
  );
}
