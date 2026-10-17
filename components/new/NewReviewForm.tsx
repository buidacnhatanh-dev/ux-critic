"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ErrorSummary } from "@/components/ErrorSummary";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  ErrorIcon,
  RadioGroup,
  Select,
  Textarea,
  TextField,
  useAnnouncer,
} from "@/components/ui";
import { useDataClient } from "@/lib/data/DataClientProvider";
import { ValidationError } from "@/lib/data/client";
import type { DemoSample, Scale, SourceSettings } from "@/lib/data/types";
import {
  ACCEPTED_TYPES,
  fileError,
  fileSize,
  isAcceptedType,
  NEW_PROJECT,
  nextVersionName,
  projectNameError,
  suggestScale,
  versionError,
  type FieldError,
} from "@/lib/new-review";
import styles from "./NewReviewForm.module.css";

export type ProjectChoice = { id: string; name: string; versionNames: string[] };

export type NewReviewInitial = {
  project?: string;
  projectName?: string;
  version?: string;
  context?: string;
  sample?: string;
};

export type NewReviewFormProps = {
  /** "demo" shows the sample picker; "live" the upload with Scale and Check against. */
  form: "demo" | "live";
  projects: ProjectChoice[];
  samples: DemoSample[];
  sources: SourceSettings;
  enabledRuleCount: number;
  initial: NewReviewInitial;
  /** Sample state on /states: validate only, never start a review. */
  preview?: boolean;
};

type Picked = {
  file: File;
  url: string | null;
  width: number | null;
};

/** Maps the data client's field names to the form's field ids. */
const SERVER_FIELD: Record<string, string> = {
  project: "project-name",
  version: "version",
  sample: "sample",
  file: "file",
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Screen 3 (New review) with screen 13 (Form errors). */
export function NewReviewForm({
  form,
  projects,
  samples,
  sources: defaultSources,
  enabledRuleCount,
  initial,
  preview = false,
}: NewReviewFormProps) {
  const client = useDataClient();
  const router = useRouter();
  const { announce } = useAnnouncer();

  const initialProject = projects.some((p) => p.id === initial.project)
    ? initial.project!
    : initial.project === "new" || initial.projectName || projects.length === 0
      ? NEW_PROJECT
      : projects[0]!.id;
  const [projectId, setProjectId] = useState(initialProject);
  const [projectName, setProjectName] = useState(
    initialProject === NEW_PROJECT ? (initial.projectName ?? "") : "",
  );
  const versionsOf = (id: string) => projects.find((p) => p.id === id)?.versionNames ?? [];
  const [versionName, setVersionName] = useState(
    initial.version ?? nextVersionName(versionsOf(initialProject)),
  );
  const [versionEdited, setVersionEdited] = useState(Boolean(initial.version));
  const [context, setContext] = useState(initial.context ?? "");
  const [sampleId, setSampleId] = useState(
    samples.some((s) => s.id === initial.sample) ? initial.sample! : "",
  );
  const [picked, setPicked] = useState<Picked | null>(null);
  const [scale, setScale] = useState<Scale>(2);
  const [scaleEdited, setScaleEdited] = useState(false);
  const [sources, setSources] = useState(defaultSources);
  const [dragging, setDragging] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focusSummary = useRef(false);

  const isNew = projectId === NEW_PROJECT;
  const existingVersions = isNew ? [] : versionsOf(projectId);

  // Errors appear on submit, then follow the fields as they are fixed (docs/06 §13).
  const errors = ((): FieldError[] => {
    if (!submitted) return [];
    const list: (FieldError | null)[] = [
      form === "demo"
        ? sampleId
          ? null
          : {
              field: "sample",
              summary: "Pick a sample screen.",
              message: "Pick a sample screen to review.",
            }
        : fileError(picked ? picked.file : null),
      isNew
        ? projectNameError(
            projectName,
            projects.map((p) => p.name),
          )
        : null,
      versionError(versionName, existingVersions),
    ];
    const local = list.filter((e): e is FieldError => e !== null);
    return [...local, ...serverErrors.filter((s) => !local.some((l) => l.field === s.field))];
  })();
  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;

  useEffect(() => {
    if (focusSummary.current && errors.length > 0) {
      focusSummary.current = false;
      summaryRef.current?.focus();
    }
  }, [errors]);

  // Object URLs for the thumbnail are freed when the file changes or the form goes away.
  useEffect(() => {
    const url = picked?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [picked?.url]);

  function chooseProject(id: string) {
    setProjectId(id);
    setServerErrors([]);
    if (!versionEdited) setVersionName(nextVersionName(id === NEW_PROJECT ? [] : versionsOf(id)));
  }

  function acceptFile(file: File) {
    setServerErrors([]);
    setPreviewDone(false);
    if (!isAcceptedType(file.type)) {
      setPicked({ file, url: null, width: null });
      return;
    }
    const url = URL.createObjectURL(file);
    setPicked({ file, url, width: null });
    const image = new Image();
    image.onload = () => {
      setPicked((current) =>
        current?.url === url ? { ...current, width: image.naturalWidth } : current,
      );
      if (!scaleEdited) setScale(suggestScale(image.naturalWidth));
    };
    image.src = url;
    announce(`${file.name} added.`);
  }

  // Paste a screenshot with Cmd+V anywhere on the page (live form only).
  useEffect(() => {
    if (form !== "live") return;
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])][0];
      if (!file) return;
      event.preventDefault();
      acceptFile(file);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) acceptFile(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setServerErrors([]);
    const problems = [
      form === "demo" ? (sampleId ? null : "sample") : fileError(picked ? picked.file : null),
      isNew
        ? projectNameError(
            projectName,
            projects.map((p) => p.name),
          )
        : null,
      versionError(versionName, existingVersions),
    ].filter(Boolean);
    if (problems.length > 0) {
      focusSummary.current = true;
      return;
    }
    if (preview) {
      setPreviewDone(true);
      announce("Everything is filled in. In live mode the review would start now.");
      return;
    }
    setBusy(true);
    try {
      const common = {
        projectId: isNew ? null : projectId,
        newProjectName: isNew ? projectName.trim() : null,
        versionName: versionName.trim(),
        context: context.trim(),
      };
      const { reviewId } =
        form === "demo"
          ? await client.startReview({
              mode: "demo",
              ...common,
              sampleId,
              instant: prefersReducedMotion(),
            })
          : await client.startReview({
              mode: "live",
              ...common,
              scale,
              file: picked!.file,
              sources,
            });
      router.push(`/reviews/${reviewId}`);
    } catch (error) {
      setBusy(false);
      const message = error instanceof Error ? error.message : String(error);
      const field =
        error instanceof ValidationError ? (SERVER_FIELD[error.field] ?? "start") : "start";
      setServerErrors([{ field, summary: message, message }]);
      focusSummary.current = true;
    }
  }

  const projectOptions = [
    ...projects.map((p) => ({ value: p.id, label: p.name })),
    { value: NEW_PROJECT, label: "New project…" },
  ];
  const sampleError = errorFor("sample");
  const fileProblem = errorFor("file");
  const startError = errorFor("start");

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <ErrorSummary ref={summaryRef} errors={errors} />

      {form === "demo" ? (
        <fieldset
          className={styles.samples}
          aria-describedby={sampleError ? "sample-error" : undefined}
        >
          <legend className={styles.legend}>Pick a sample screen</legend>
          {sampleError ? (
            <p id="sample-error" className={styles.error}>
              <ErrorIcon />
              {sampleError}
            </p>
          ) : null}
          <div className={styles.sampleGrid}>
            {samples.map((sample, index) => (
              <label
                key={sample.id}
                className={styles.sample}
                data-checked={sampleId === sample.id || undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- sample screenshots as they are */}
                <img src={sample.screenshotUrl} alt="" className={styles.sampleImage} />
                <span className={styles.sampleName}>
                  <input
                    id={index === 0 ? "sample" : undefined}
                    type="radio"
                    name="sample"
                    value={sample.id}
                    checked={sampleId === sample.id}
                    onChange={() => {
                      setSampleId(sample.id);
                      setServerErrors([]);
                    }}
                    className={styles.radio}
                  />
                  {sample.name}
                </span>
              </label>
            ))}
          </div>
          <p className={styles.note}>
            In the demo, reviews are prepared in advance. Run UX Critic on your own laptop with a
            Claude API key to review any screenshot.
          </p>
        </fieldset>
      ) : (
        <div className={styles.fileField}>
          <div
            className={styles.drop}
            data-dragging={dragging || undefined}
            data-invalid={fileProblem ? true : undefined}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {picked ? (
              <div className={styles.picked}>
                {picked.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
                  <img src={picked.url} alt="" className={styles.pickedImage} />
                ) : (
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M5 2h8l4 4v14H5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path d="M13 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                )}
                <span className={styles.pickedName}>{picked.file.name}</span>
                <span className={styles.pickedSize}>{fileSize(picked.file.size)}</span>
                <Button
                  variant="text"
                  onClick={() => {
                    setPicked(null);
                    announce("Screenshot removed.");
                    document.getElementById("file")?.focus();
                  }}
                >
                  Remove<span className="visually-hidden"> {picked.file.name}</span>
                </Button>
              </div>
            ) : (
              <>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 56 56"
                  aria-hidden="true"
                  focusable="false"
                  className={styles.dropIcon}
                >
                  <rect
                    x="8"
                    y="12"
                    width="40"
                    height="32"
                    rx="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="20"
                    cy="24"
                    r="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M10 40l12-11 9 8 6-5 10 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className={styles.dropTitle}>Drop a screenshot or paste it</p>
              </>
            )}
            <Button
              id="file"
              variant="secondary"
              className={styles.choose}
              aria-describedby={[fileProblem ? "file-error" : null, "file-hint"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => fileInputRef.current?.click()}
            >
              {picked ? "Choose a different file" : "Choose a file"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) acceptFile(file);
                event.target.value = "";
              }}
              data-testid="file-input"
            />
            <p id="file-hint" className={styles.dropHint}>
              PNG, JPG or WebP · one screen at a time works best · or press Cmd+V to paste
            </p>
          </div>
          {fileProblem ? (
            <p id="file-error" className={styles.error}>
              <ErrorIcon />
              {fileProblem}
            </p>
          ) : null}
        </div>
      )}

      <div className={styles.row}>
        <Select
          id="project"
          label="Project"
          options={projectOptions}
          value={projectId}
          onChange={(event) => chooseProject(event.target.value)}
        />
        <TextField
          id="version"
          label="Version name"
          value={versionName}
          onChange={(event) => {
            setVersionName(event.target.value);
            setVersionEdited(true);
            setServerErrors([]);
          }}
          error={errorFor("version")}
          autoComplete="off"
        />
      </div>

      {isNew ? (
        <TextField
          id="project-name"
          label="Project name"
          value={projectName}
          onChange={(event) => {
            setProjectName(event.target.value);
            setServerErrors([]);
          }}
          error={errorFor("project-name")}
          autoComplete="off"
        />
      ) : null}

      {form === "live" ? (
        <div className={styles.scale}>
          <RadioGroup
            legend="Scale"
            name="scale"
            hint="2× for Retina screenshots"
            value={String(scale)}
            onChange={(value) => {
              setScale(Number(value) as Scale);
              setScaleEdited(true);
            }}
            options={[
              { value: "1", label: "1×" },
              { value: "2", label: "2×" },
              { value: "3", label: "3×" },
            ]}
          />
        </div>
      ) : null}

      <Textarea
        id="context"
        label="What is this screen for? (optional)"
        hint="Context helps the review. For example who uses it and what they are trying to do."
        value={context}
        onChange={(event) => setContext(event.target.value)}
        rows={3}
      />

      {form === "live" ? (
        <div className={styles.sources}>
          <CheckboxGroup legend="Check against">
            <div className={styles.sourceGrid}>
              <Checkbox
                label="Nielsen's 10 heuristics"
                description="Evaluated"
                checked={sources.nielsen}
                onChange={(e) => setSources({ ...sources, nielsen: e.target.checked })}
              />
              <Checkbox
                label="WCAG 2.2"
                description="Measured where possible"
                checked={sources.wcag}
                onChange={(e) => setSources({ ...sources, wcag: e.target.checked })}
              />
              <Checkbox
                label="Laws of UX"
                description="Evaluated"
                checked={sources.laws}
                onChange={(e) => setSources({ ...sources, laws: e.target.checked })}
              />
              <div className={styles.mine}>
                <Checkbox
                  label="My checklist"
                  description={`${enabledRuleCount === 1 ? "1 rule" : `${enabledRuleCount} rules`}`}
                  checked={sources.mine}
                  onChange={(e) => setSources({ ...sources, mine: e.target.checked })}
                />
                <Link href="/checklist" className={styles.edit}>
                  Edit<span className="visually-hidden"> my checklist</span>
                </Link>
              </div>
            </div>
          </CheckboxGroup>
        </div>
      ) : null}

      <div className={styles.submit}>
        <Button id="start" type="submit" disabled={busy}>
          Start review
        </Button>
        <p className={styles.note}>
          {preview
            ? "Errors show after you press Start review, never while typing."
            : form === "demo"
              ? "The demo replays a prepared review. Nothing is sent anywhere."
              : "The screenshot is sent to Claude for the review and saved only on this laptop."}
        </p>
      </div>
      {startError ? <p className={styles.error}>{startError}</p> : null}
      {previewDone ? (
        <p className={styles.previewDone}>
          Everything is filled in. In live mode the review would start now; this sample form stops
          here.
        </p>
      ) : null}
    </form>
  );
}
