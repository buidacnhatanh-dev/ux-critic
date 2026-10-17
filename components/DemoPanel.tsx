"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button, Dialog, Pill, useToast } from "@/components/ui";
import { useDataClient } from "@/lib/data/DataClientProvider";
import styles from "./DemoPanel.module.css";

/** Demo pill, source line, "How this demo works" and "Reset demo" (docs/10). */
export function DemoPanel({ sourceLine }: { sourceLine: string }) {
  const client = useDataClient();
  const { showToast } = useToast();
  const [howOpen, setHowOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  async function reset() {
    await client.resetDemo?.();
    setResetOpen(false);
    showToast({ message: "Demo reset. Your changes in this browser are cleared." });
  }

  return (
    <div className={styles.panel}>
      <p className={styles.source}>
        <Pill tone="demo">Demo</Pill>
        <span>{sourceLine}</span>
      </p>
      <Button variant="text" className={styles.action} onClick={() => setHowOpen(true)}>
        How this demo works
      </Button>
      <Button variant="text" className={styles.action} onClick={() => setResetOpen(true)}>
        Reset demo
      </Button>

      <Dialog
        open={howOpen}
        onClose={() => setHowOpen(false)}
        title="How this demo works"
        footer={
          <>
            <Link href="/states" className={styles.footerLink} onClick={() => setHowOpen(false)}>
              See all screen states
            </Link>
            <Button variant="secondary" onClick={() => setHowOpen(false)}>
              Close
            </Button>
          </>
        }
      >
        <p>UX Critic reviews a screenshot in two ways.</p>
        <p>
          <strong>Measured:</strong> code reads the pixels for contrast and sizes.
        </p>
        <p>
          <strong>Evaluated:</strong> Claude checks the screen against named UX principles.
        </p>
        <p>
          This online demo uses prepared reviews and never calls Claude, so it is free and private.
          On my laptop the same app runs live with my own API key.
        </p>
      </Dialog>

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the demo?"
        role="alertdialog"
        initialFocus={keepRef}
        footer={
          <>
            <Button ref={keepRef} variant="secondary" onClick={() => setResetOpen(false)}>
              Keep my changes
            </Button>
            <Button variant="danger" onClick={reset}>
              Reset demo
            </Button>
          </>
        }
      >
        <p>
          This clears your push backs, checklist changes and deleted projects in this browser and
          brings back the sample projects.
        </p>
      </Dialog>
    </div>
  );
}
