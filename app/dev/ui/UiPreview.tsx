"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Button,
  ButtonLink,
  Checkbox,
  CheckboxGroup,
  Dialog,
  KindPill,
  Pill,
  RadioGroup,
  Select,
  SeverityCountPill,
  SeverityPill,
  Textarea,
  TextField,
  Tooltip,
  useAnnouncer,
  useToast,
} from "@/components/ui";
import styles from "./UiPreview.module.css";

const PLUS = (
  <svg width="16" height="16" viewBox="0 0 18 18">
    <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const KIND_OPTIONS = [
  { value: "measured", label: "Measured", description: "Exact, for sizes and colours only" },
  { value: "evaluated", label: "Evaluated", description: "For anything that needs an opinion" },
];

const PROJECT_OPTIONS = [
  { value: "", label: "Choose a project" },
  { value: "sample-a", label: "Sample project A" },
  { value: "sample-b", label: "Sample project B" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.heading}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <h3 className={styles.rowLabel}>{label}</h3>
      <div className={styles.items}>{children}</div>
    </div>
  );
}

export function UiPreview() {
  const { showToast } = useToast();
  const { announce } = useAnnouncer();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [kind, setKind] = useState("measured");
  const ruleRef = useRef<HTMLTextAreaElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <h1>UI components</h1>
      <p className={styles.intro}>
        Development only. Every component from <code>components/ui</code> in each variant and state.
        Press Tab to check the focus ring.
      </p>

      <Section id="buttons" title="Button">
        {(["primary", "secondary", "danger", "text"] as const).map((variant) => (
          <Row key={variant} label={variant}>
            <Button variant={variant}>Save rule</Button>
            <Button variant={variant} icon={PLUS}>
              New review
            </Button>
            <Button variant={variant} disabled>
              Disabled (aria-disabled)
            </Button>
          </Row>
        ))}
        <Row label="text, destructive">
          <Button variant="text" destructive>
            Delete rule
          </Button>
        </Row>
        <Row label="ButtonLink">
          <ButtonLink href="/new" icon={PLUS}>
            New review
          </ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Back to projects
          </ButtonLink>
        </Row>
      </Section>

      <Section id="textfield" title="TextField">
        <div className={styles.grid}>
          <TextField label="Version name" placeholder="v1" />
          <TextField label="Version name (hint)" hint="For example v2 or After fixes" />
          <TextField
            label="Version name (error)"
            defaultValue="v2"
            error='"v2" already exists. Try "v3".'
          />
          <TextField label="Version name (disabled)" defaultValue="v1" disabled />
        </div>
      </Section>

      <Section id="textarea" title="Textarea">
        <div className={styles.grid}>
          <Textarea
            label="What is this screen for?"
            hint="Optional. One or two sentences help the evaluation."
          />
          <Textarea
            label="Why do you disagree? (error)"
            error="Write a reason, so the next review can learn from it."
          />
        </div>
      </Section>

      <Section id="select" title="Select">
        <div className={styles.grid}>
          <Select label="Project" options={PROJECT_OPTIONS} defaultValue="sample-a" />
          <Select
            label="Project (error)"
            options={PROJECT_OPTIONS}
            defaultValue=""
            error="Choose a project or create a new one."
          />
        </div>
      </Section>

      <Section id="checkbox" title="Checkbox">
        <CheckboxGroup legend="Principles">
          <Checkbox label="Nielsen's 10 heuristics" description="Usability basics" defaultChecked />
          <Checkbox label="WCAG 2.2 AA" description="The parts visible in a screenshot" />
          <Checkbox label="Laws of UX (disabled)" disabled />
          <Checkbox label="My checklist (checked, disabled)" disabled defaultChecked />
        </CheckboxGroup>
      </Section>

      <Section id="radio" title="RadioGroup">
        <div className={styles.grid}>
          <RadioGroup
            legend="Checked by"
            name="kind-demo"
            options={KIND_OPTIONS}
            value={kind}
            onChange={setKind}
          />
          <RadioGroup
            legend="Checked by (error)"
            name="kind-error"
            options={KIND_OPTIONS}
            error="Choose how this rule is checked."
          />
        </div>
      </Section>

      <Section id="pill" title="Pill">
        <Row label="severity">
          <SeverityPill severity="high" />
          <SeverityPill severity="medium" />
          <SeverityPill severity="low" />
        </Row>
        <Row label="severity counts">
          <SeverityCountPill severity="high" count={1} />
          <SeverityCountPill severity="medium" count={4} />
          <SeverityCountPill severity="low" count={3} />
          <SeverityCountPill severity="high" count={0} />
        </Row>
        <Row label="kind">
          <KindPill kind="measured" />
          <KindPill kind="evaluated" />
        </Row>
        <Row label="other">
          <Pill tone="neutral">Neutral</Pill>
          <Pill tone="demo">Demo</Pill>
        </Row>
      </Section>

      <Section id="tooltip" title="Tooltip">
        <Row label="placement">
          <Tooltip content="Regions are approximate. They show roughly where the issue is.">
            <Button variant="secondary">Tooltip on top</Button>
          </Tooltip>
          <Tooltip content="Measured from pixels" placement="bottom">
            <Button variant="secondary">Tooltip below</Button>
          </Tooltip>
        </Row>
      </Section>

      <Section id="dialog" title="Dialog">
        <Row label="variants">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button variant="danger" onClick={() => setAlertOpen(true)}>
            Open alert dialog
          </Button>
        </Row>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Edit rule"
          initialFocus={ruleRef}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Save rule</Button>
            </>
          }
        >
          <Textarea
            ref={ruleRef}
            label="Rule"
            rows={2}
            defaultValue="Touch targets are at least 44 by 44 px"
          />
        </Dialog>
        <Dialog
          open={alertOpen}
          onClose={() => setAlertOpen(false)}
          title='Delete "Sample project A"?'
          role="alertdialog"
          initialFocus={keepRef}
          footer={
            <>
              <Button ref={keepRef} variant="secondary" onClick={() => setAlertOpen(false)}>
                Keep project
              </Button>
              <Button variant="danger" onClick={() => setAlertOpen(false)}>
                Delete project
              </Button>
            </>
          }
        >
          <p>Preview only. Nothing is deleted. You can&apos;t undo this in the real dialog.</p>
        </Dialog>
      </Section>

      <Section id="toast" title="Toast">
        <Row label="variants">
          <Button variant="secondary" onClick={() => showToast({ message: "Saved" })}>
            Show toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              showToast({
                message: "Deleted rule",
                onUndo: () => showToast({ message: "Rule restored" }),
              })
            }
          >
            Show toast with Undo
          </Button>
        </Row>
      </Section>

      <Section id="announcer" title="Announcer">
        <Row label="politeness">
          <Button variant="secondary" onClick={() => announce("Measuring done, evaluating next")}>
            Announce politely
          </Button>
          <Button variant="secondary" onClick={() => announce("Review failed", "assertive")}>
            Announce assertively
          </Button>
        </Row>
      </Section>
    </>
  );
}
