"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoadStatus } from "@/components/LoadStatus";
import {
  Button,
  Checkbox,
  KindPill,
  Select,
  TextField,
  useAnnouncer,
  useToast,
} from "@/components/ui";
import { useLoad } from "@/components/useLoad";
import { useDataClient } from "@/lib/data/DataClientProvider";
import type {
  ChecklistUpdate,
  IssueKind,
  Rule,
  RuleMetric,
  SourceSettings,
} from "@/lib/data/types";
import { plural } from "@/lib/format";
import {
  DEFAULT_THRESHOLD,
  METRIC_OPTIONS,
  ruleErrors,
  ruleFields,
  type RuleDraft,
  type RuleErrors,
} from "@/lib/rules";
import { EditRuleDialog } from "./EditRuleDialog";
import styles from "./ChecklistScreen.module.css";

export type Connection = {
  model: string | null;
  keySaved: boolean;
  pricesSet: boolean;
};

const PRINCIPLES: { key: keyof SourceSettings; label: string; description: string }[] = [
  {
    key: "nielsen",
    label: "Nielsen's 10 heuristics",
    description: "Usability problems in general. Evaluated against each heuristic.",
  },
  {
    key: "wcag",
    label: "WCAG 2.2, level AA",
    description: "Contrast and target size are measured. The rest is evaluated.",
  },
  {
    key: "laws",
    label: "Laws of UX",
    description: "Hick's law, Fitts's law, Jakob's law and others. Evaluated against each law.",
  },
];

const pencil = (
  <svg width="18" height="18" viewBox="0 0 18 18" focusable="false">
    <path
      d="M11.5 3.5l3 3L6 15H3v-3z M10 5l3 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const emptyDraft: RuleDraft = {
  text: "",
  kind: "evaluated",
  metric: "target_size_min",
  threshold: "44",
};

/** Screen 6 (My checklist) with screen 14 (Edit a rule). */
export function ChecklistScreen({ connection }: { connection: Connection }) {
  const client = useDataClient();
  const { showToast } = useToast();
  const { announce } = useAnnouncer();
  const { state, reload } = useLoad(() => client.getChecklist(), "checklist");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [errors, setErrors] = useState<RuleErrors>({});
  const ruleTextRef = useRef<HTMLInputElement>(null);
  const thresholdRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** Element id to focus once the list has re-rendered. */
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    const element = document.getElementById(id);
    if (element) {
      focusNext.current = null;
      element.focus();
    }
  });

  if (state.status !== "ready") return <LoadStatus state={state} what="checklist" />;
  const checklist = state.data;
  const rules = [...checklist.rules].sort((a, b) => a.position - b.position);
  const editing = rules.find((r) => r.id === editingId) ?? null;
  const place = editing ? rules.indexOf(editing) + 1 : 0;

  async function save(update: ChecklistUpdate) {
    await client.saveChecklist(update);
    await reload();
  }

  async function toggleSource(key: keyof SourceSettings, on: boolean) {
    await save({ type: "sources", sources: { ...checklist.sources, [key]: on } });
    showToast({ message: "Saved" });
  }

  async function addRule(event: FormEvent) {
    event.preventDefault();
    const found = ruleErrors(draft);
    setErrors(found);
    if (found.text) return ruleTextRef.current?.focus();
    if (found.threshold) return thresholdRef.current?.focus();
    await save({ type: "createRule", rule: { ...ruleFields(draft), enabled: true } });
    setDraft(emptyDraft);
    showToast({ message: "Rule added" });
    ruleTextRef.current?.focus();
  }

  function deleteRule(rule: Rule) {
    setDialogOpen(false);
    void (async () => {
      await save({ type: "deleteRule", ruleId: rule.id });
      setEditingId(null);
      focusNext.current = "rules-title";
      headingRef.current?.focus();
      showToast({
        message: `Deleted rule: ${rule.text}`,
        onUndo: () => {
          void (async () => {
            focusNext.current = `edit-rule-${rule.id}`;
            await save({ type: "restoreRule", rule });
            announce(`Rule restored: ${rule.text}`);
          })();
        },
      });
    })();
  }

  return (
    <>
      <h1>My checklist</h1>
      <p className={styles.lead}>What every review checks, and how I design.</p>
      {client.mode === "demo" ? (
        <p className={styles.demoNote}>In the demo, checklist changes apply to new reviews only.</p>
      ) : null}

      <section aria-labelledby="principles-title" className={styles.section}>
        <h2 id="principles-title" className={styles.sectionTitle}>
          Principles
        </h2>
        <ul className={styles.box}>
          {PRINCIPLES.map((p) => (
            <li key={p.key} className={styles.boxRow}>
              <Checkbox
                label={p.label}
                description={p.description}
                checked={checklist.sources[p.key]}
                onChange={(e) => toggleSource(p.key, e.target.checked)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rules-title" className={styles.section}>
        <div className={styles.rulesHead}>
          <h2 id="rules-title" ref={headingRef} tabIndex={-1} className={styles.sectionTitle}>
            My own rules
          </h2>
          <span className={styles.count}>{plural(rules.length, "rule")}</span>
        </div>
        {rules.length === 0 ? (
          <p className={styles.muted}>No rules yet. Add one below.</p>
        ) : (
          <ol className={styles.box}>
            {rules.map((rule) => (
              <li key={rule.id} className={[styles.boxRow, styles.rule].join(" ")}>
                <span className={styles.ruleText}>{rule.text}</span>
                <KindPill kind={rule.kind} />
                <button
                  type="button"
                  id={`edit-rule-${rule.id}`}
                  className={styles.edit}
                  aria-label={`Edit rule: ${rule.text}`}
                  onClick={() => {
                    setEditingId(rule.id);
                    setDialogOpen(true);
                  }}
                >
                  {pencil}
                </button>
              </li>
            ))}
          </ol>
        )}

        <form className={styles.add} onSubmit={addRule} noValidate>
          <TextField
            ref={ruleTextRef}
            label="Add a rule"
            placeholder="For example: never more than 2 typefaces"
            value={draft.text}
            error={errors.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            className={styles.addText}
          />
          <Select
            label="Checked by"
            options={[
              { value: "evaluated", label: "Evaluated" },
              { value: "measured", label: "Measured (sizes and colours only)" },
            ]}
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as IssueKind })}
          />
          {draft.kind === "measured" ? (
            <>
              <Select
                label="What is measured"
                options={METRIC_OPTIONS.map(({ value, label }) => ({ value, label }))}
                value={draft.metric}
                onChange={(e) => {
                  const metric = e.target.value as RuleMetric;
                  setDraft({ ...draft, metric, threshold: String(DEFAULT_THRESHOLD[metric]) });
                }}
              />
              <TextField
                ref={thresholdRef}
                label={
                  draft.metric === "contrast_min" ? "Threshold (ratio, : 1)" : "Threshold (CSS px)"
                }
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={draft.threshold}
                error={errors.threshold}
                onChange={(e) => setDraft({ ...draft, threshold: e.target.value })}
              />
            </>
          ) : null}
          <Button type="submit" className={styles.addButton}>
            Add rule
          </Button>
        </form>
      </section>

      <section aria-labelledby="connection-title" className={styles.section}>
        <h2 id="connection-title" className={styles.sectionTitle}>
          Connection
        </h2>
        {client.mode === "demo" ? (
          <p className={[styles.box, styles.connectionDemo].join(" ")}>
            Demo mode · no API key needed
          </p>
        ) : (
          <dl className={[styles.box, styles.connection].join(" ")}>
            <div>
              <dt>Model</dt>
              <dd>{connection.model ?? "Not set (UXC_MODEL)"}</dd>
            </div>
            <div>
              <dt>API key</dt>
              <dd>{connection.keySaved ? "Saved in .env.local" : "Missing"}</dd>
            </div>
            <div>
              <dt>Spent this month</dt>
              <dd>
                {connection.pricesSet
                  ? "Counted once live reviews are saved"
                  : "[set prices in .env.local]"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <EditRuleDialog
        rule={editing}
        open={dialogOpen && Boolean(editing)}
        place={place}
        count={rules.length}
        onClose={() => setDialogOpen(false)}
        onSave={async (fields) => {
          if (!editing) return;
          await save({ type: "updateRule", rule: { ...editing, ...fields } });
          setDialogOpen(false);
          showToast({ message: "Rule saved" });
        }}
        onMove={async (direction) => {
          if (!editing) return;
          await save({ type: "moveRule", ruleId: editing.id, direction });
          const next = direction === "up" ? place - 1 : place + 1;
          announce(`Moved ${direction}. Rule ${next} of ${rules.length}.`);
        }}
        onDelete={() => editing && deleteRule(editing)}
      />
    </>
  );
}
