"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from "react";
import { Button, KindPill, Pill, SeverityPill, Textarea } from "@/components/ui";
import type { Issue } from "@/lib/data/types";
import styles from "./IssueCard.module.css";

export type IssueCardProps = {
  issue: Issue;
  /** "Based on …" display name. */
  principle: string;
  expanded: boolean;
  onToggle: () => void;
  onPushback: (reason: string) => Promise<void>;
  onUndoPushback: () => Promise<void>;
  headerRef?: Ref<HTMLButtonElement>;
};

type Mode = "view" | "form";

/**
 * One issue: the header is a disclosure button; the body has the detail, the suggested fix and
 * either "I disagree", the reason form, or "Why I disagree" with Undo (docs/06 §4).
 */
export function IssueCard({
  issue,
  principle,
  expanded,
  onToggle,
  onPushback,
  onUndoPushback,
  headerRef,
}: IssueCardProps) {
  const bodyId = useId();
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disagreeRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  /** Where focus goes after the next render: the form, Undo or I disagree. */
  const focusNext = useRef<"textarea" | "undo" | "disagree" | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    const element = { textarea: textareaRef, undo: undoRef, disagree: disagreeRef }[target].current;
    if (element) {
      element.focus();
      focusNext.current = null;
    }
  });

  // Closing the card drops an unsaved reason form.
  const [wasExpanded, setWasExpanded] = useState(expanded);
  if (expanded !== wasExpanded) {
    setWasExpanded(expanded);
    if (!expanded) {
      setMode("view");
      setError(undefined);
    }
  }

  function openForm() {
    setReason("");
    setError(undefined);
    setMode("form");
    focusNext.current = "textarea";
  }

  function cancel() {
    setMode("view");
    setError(undefined);
    focusNext.current = "disagree";
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!reason.trim()) {
      setError("Write why this is not a problem here, then save.");
      textareaRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await onPushback(reason.trim());
      setMode("view");
      setError(undefined);
      focusNext.current = "undo";
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (busy) return;
    setBusy(true);
    try {
      await onUndoPushback();
      focusNext.current = "disagree";
    } finally {
      setBusy(false);
    }
  }

  const pushedBack = Boolean(issue.pushback);
  const tone = pushedBack ? styles.pushedBack : styles[issue.kind];

  return (
    <article
      id={`issue-${issue.number}`}
      className={[styles.card, tone, expanded ? styles.expanded : ""].join(" ")}
      data-issue-id={issue.id}
    >
      <h3 className={styles.heading}>
        <button
          ref={headerRef}
          type="button"
          className={styles.header}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className={styles.number} aria-hidden="true">
            {issue.number}
          </span>
          <span className={styles.headText}>
            <span className={styles.title}>
              <span className="visually-hidden">Issue {issue.number}: </span>
              {issue.title}
            </span>
            <span className={styles.meta}>
              <KindPill kind={issue.kind} />
              <SeverityPill severity={issue.severity} />
              {pushedBack ? <Pill tone="measured">I disagreed</Pill> : null}
              <span className={styles.basedOn}>Based on {principle}</span>
            </span>
          </span>
        </button>
      </h3>

      <div id={bodyId} className={styles.body} hidden={!expanded}>
        <p className={styles.detail}>{issue.detail}</p>
        <div className={styles.fix}>
          <p className={styles.fixLabel}>Suggested fix</p>
          <p className={styles.fixText}>{issue.fix}</p>
        </div>

        {issue.pushback ? (
          <div className={styles.reasonBox}>
            <p className={styles.reasonLabel}>Why I disagree</p>
            <p className={styles.reasonText}>{issue.pushback.reason}</p>
            <div className={styles.footer}>
              <span className={styles.source}>{sourceLine(issue)}</span>
              <Button
                ref={undoRef}
                variant="secondary"
                className={styles.footerButton}
                onClick={undo}
              >
                Undo
                <span className="visually-hidden"> my reason for issue {issue.number}</span>
              </Button>
            </div>
          </div>
        ) : mode === "form" ? (
          <form className={styles.form} onSubmit={save} noValidate>
            <Textarea
              ref={textareaRef}
              label="Why is this not a problem here?"
              hint="Your reason is kept with this review."
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                // After a failed submit, the error goes away once the field is fixed.
                if (error && event.target.value.trim()) setError(undefined);
              }}
              error={error}
              rows={3}
            />
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save reason
              </Button>
            </div>
          </form>
        ) : (
          <div className={styles.footer}>
            <span className={styles.source}>{sourceLine(issue)}</span>
            <Button
              ref={disagreeRef}
              variant="secondary"
              className={styles.footerButton}
              onClick={openForm}
            >
              I disagree
              <span className="visually-hidden"> with issue {issue.number}</span>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function sourceLine(issue: Issue): string {
  if (issue.kind === "measured") return "Measured from pixels";
  return issue.confidence ? `Confidence: ${issue.confidence}` : "Confidence: not given";
}
