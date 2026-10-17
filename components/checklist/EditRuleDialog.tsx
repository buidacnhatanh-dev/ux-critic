"use client";

import { useRef, useState, type FormEvent, type RefObject } from "react";
import { Button, Dialog, RadioGroup, Select, Textarea, TextField } from "@/components/ui";
import type { IssueKind, Rule, RuleMetric } from "@/lib/data/types";
import {
  DEFAULT_THRESHOLD,
  METRIC_OPTIONS,
  ruleErrors,
  ruleFields,
  type RuleDraft,
  type RuleErrors,
} from "@/lib/rules";
import styles from "./EditRuleDialog.module.css";

export type EditRuleDialogProps = {
  rule: Rule | null;
  open: boolean;
  /** 1-based place in the list, and the list length, for Move up and Move down. */
  place: number;
  count: number;
  onClose: () => void;
  onSave: (fields: ReturnType<typeof ruleFields>) => Promise<void>;
  onMove: (direction: "up" | "down") => Promise<void>;
  onDelete: () => void;
};

/** Screen 14. Focus starts in the rule text; Escape and Cancel close without saving. */
export function EditRuleDialog({
  rule,
  open,
  place,
  count,
  onClose,
  onSave,
  onMove,
  onDelete,
}: EditRuleDialogProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Dialog open={open} onClose={onClose} title="Edit rule" initialFocus={textRef}>
      {rule ? (
        <RuleForm
          key={rule.id}
          rule={rule}
          textRef={textRef}
          place={place}
          count={count}
          onCancel={onClose}
          onSave={onSave}
          onMove={onMove}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  );
}

function RuleForm({
  rule,
  textRef,
  place,
  count,
  onCancel,
  onSave,
  onMove,
  onDelete,
}: {
  rule: Rule;
  textRef: RefObject<HTMLTextAreaElement | null>;
  place: number;
  count: number;
  onCancel: () => void;
  onSave: EditRuleDialogProps["onSave"];
  onMove: EditRuleDialogProps["onMove"];
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>({
    text: rule.text,
    kind: rule.kind,
    metric: rule.metric ?? "target_size_min",
    threshold:
      rule.threshold !== null ? String(rule.threshold) : String(DEFAULT_THRESHOLD.target_size_min),
  });
  const [errors, setErrors] = useState<RuleErrors>({});
  const thresholdRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = ruleErrors(draft);
    setErrors(found);
    if (found.text) return textRef.current?.focus();
    if (found.threshold) return thresholdRef.current?.focus();
    await onSave(ruleFields(draft));
  }

  const metric = METRIC_OPTIONS.find((m) => m.value === draft.metric)!;

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <Textarea
        ref={textRef}
        label="Rule"
        rows={2}
        value={draft.text}
        error={errors.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
      />
      <RadioGroup
        legend="Checked by"
        name={`kind-${rule.id}`}
        value={draft.kind}
        onChange={(value) => setDraft({ ...draft, kind: value as IssueKind })}
        options={[
          {
            value: "measured",
            label: "Measured",
            description: "Exact, for sizes and colours only",
          },
          {
            value: "evaluated",
            label: "Evaluated",
            description: "For anything that needs an opinion",
          },
        ]}
      />
      {draft.kind === "measured" ? (
        <div className={styles.metric}>
          <Select
            label="What is measured"
            options={METRIC_OPTIONS.map(({ value, label }) => ({ value, label }))}
            value={draft.metric}
            onChange={(e) => {
              const next = e.target.value as RuleMetric;
              setDraft({ ...draft, metric: next, threshold: String(DEFAULT_THRESHOLD[next]) });
            }}
          />
          <TextField
            ref={thresholdRef}
            label={
              metric.value === "contrast_min" ? "Threshold (ratio, : 1)" : "Threshold (CSS px)"
            }
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft.threshold}
            error={errors.threshold}
            onChange={(e) => setDraft({ ...draft, threshold: e.target.value })}
          />
        </div>
      ) : null}
      <div className={styles.move} role="group" aria-label={`Position: rule ${place} of ${count}`}>
        <span className={styles.position} aria-hidden="true">
          Rule {place} of {count}
        </span>
        <Button variant="secondary" disabled={place <= 1} onClick={() => onMove("up")}>
          Move up
        </Button>
        <Button variant="secondary" disabled={place >= count} onClick={() => onMove("down")}>
          Move down
        </Button>
      </div>
      <div className={styles.footer}>
        <Button variant="text" destructive className={styles.delete} onClick={onDelete}>
          Delete rule
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save rule</Button>
      </div>
    </form>
  );
}
