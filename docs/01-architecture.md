# 01 · Architecture

## Folder layout

```
ux-critic/
  app/
    layout.tsx                 fonts, tokens.css, Announcer, Toast region, sidebar shell
    tokens.css                 design tokens as CSS variables
    page.tsx                   Projects (or First use when there are none)
    setup/page.tsx             Connect Claude
    new/page.tsx               New review (+ form errors)
    projects/[id]/page.tsx     Project history (+ delete dialog)
    projects/[id]/compare/page.tsx
    reviews/[id]/page.tsx      Reviewing / Review / Failed / Partial / No issues
    checklist/page.tsx         My checklist (+ edit rule dialog)
    api/reviews/route.ts       POST: create version + start review
    api/reviews/[id]/route.ts  GET: status and results (polled)
    api/reviews/[id]/retry/route.ts  POST: retry evaluation only
    api/issues/[id]/pushback/route.ts  PUT / DELETE
    api/rules/…                CRUD
    api/projects/[id]/route.ts DELETE
  lib/
    data/client.ts             DataClient interface, useDataClient()
    data/demo-client.ts        demo data + localStorage overlay
    data/live-client.ts        calls the API routes
    db/schema.ts, db/client.ts
    pipeline/run.ts            orchestrates the steps
    pipeline/image.ts          sharp: load, resize, scale mapping
    pipeline/ocr.ts            tesseract.js: text lines with boxes
    pipeline/measure.ts        contrast, text size, target size
    pipeline/locate.ts         Claude call 1: interactive controls
    pipeline/evaluate.ts       Claude call 2: evaluated issues
    pipeline/place.ts          map boxes to the original image, dedupe, number
    principles.ts              catalogue from docs/05
    compare.ts                 issue matching between versions
    contrast.ts                WCAG maths
    fake-ai.ts                 fixtures for UXC_FAKE_AI=1
  components/ui/               Button, TextField, Textarea, Select, Checkbox, RadioGroup, Dialog, Toast, Announcer, Tooltip, Pill
  components/                  app components (Sidebar, ScreenshotViewer with regions, IssueCard, ErrorSummary…)
  data/                        uxcritic.db, screenshots/ (gitignored, live mode only)
  demo/data.json               sample projects and reviews for demo mode
  public/demo/*.png            sample screenshots
  eval/
    fixtures/*.html            pages with planted problems
    cases/*.png + *.json       screenshots and expected issues
    runs/                      reports (gitignored)
    run.ts
  tests/e2e/*.spec.ts
```

## Design tokens and UI components

All colours, fonts, radii and spacing come from `app/tokens.css`. Components never use raw hex values.

```css
:root {
  --color-ink: #15181D;          /* text, measured badges */
  --color-text-muted: #4A5260;   /* secondary text, 7.9 : 1 on white */
  --color-border: #DDE1E7;       /* decorative borders */
  --color-border-input: #8A93A3; /* input borders, 3.1 : 1 on white */
  --color-surface: #F7F8FA;
  --color-primary: #1D4ED8;      /* buttons, links, evaluated badges, 6.7 : 1 on white */
  --color-primary-tint: #E8EEFC;
  --color-primary-soft: #F3F6FD;
  --color-high: #B42318;  --color-high-bg: #FEE4E2;
  --color-medium: #7A5600; --color-medium-bg: #FFF4D1;
  --color-low: #4A5260;   --color-low-bg: #EEF1F5;
  --color-success: #1A7F3C;
  --focus-ring: 0 0 0 2px #FFFFFF, 0 0 0 4px #15181D, 0 0 0 7px #FFC21A;
  --radius-control: 8px; --radius-card: 14px; --radius-pill: 999px;
  --font-heading: "Overpass", sans-serif;
  --font-body: "Atkinson Hyperlegible Next", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --weight-regular: 400;  --weight-medium: 500;
  --weight-semibold: 600; --weight-heading: 600;
}
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid transparent; /* stays visible in forced colours mode */
  box-shadow: var(--focus-ring);
}
```

UI components in `components/ui/`, each with a unit test:

| Component | Notes |
|---|---|
| Button | variants primary, secondary (outlined), danger, text; at least 44 px tall; `aria-disabled` instead of `disabled` |
| TextField, Textarea, Select | visible label, hint and error linked with `aria-describedby`, `aria-invalid` on error |
| Checkbox, RadioGroup | native inputs, 22 px boxes, whole row clickable, group in `fieldset` with `legend` |
| Dialog | native `<dialog>` with `showModal()`, Escape closes, focus moves in and returns to the opener, `initialFocus` prop |
| Toast | bottom left, polite announcement, optional Undo action, stays 8 seconds, pauses on hover and focus |
| Announcer | one polite and one assertive hidden live region for the whole app, `useAnnouncer()` hook |
| Tooltip | on hover and focus, Escape hides |
| Pill | severity and kind badges, always with text |

## Review data flow

```
browser                         server (Route Handlers)                    Claude API
  New review form ──POST /api/reviews──▶ save screenshot + version
                                         create review (status: queued)
                                         start pipeline (not awaited)
  /reviews/[id] polls GET every 1 s ◀──  status + step + results so far
                                         1 prepare image (sharp)
                                         2 measure: OCR text ─┐
                                                 locate controls ─────────────▶ call 1
                                                 compute contrast, sizes
                                           save measurements + measured issues
                                         3 evaluate ──────────────────────────▶ call 2
                                         4 place notes, save, status: done
```

The pipeline runs inside the Next.js server process (no queue needed for one user). If the server restarts mid review, reviews left in a running status are marked failed on next start, with measured results kept.

## Environment

```
UXC_MODE=demo                 demo or live (docs/10). Without a key, live falls back to demo
ANTHROPIC_API_KEY=            live mode only, never on Vercel
UXC_MODEL=claude-sonnet-5-5   model id, change without code changes
UXC_TIMEOUT_MS=60000          per Claude call
UXC_PRICE_INPUT_PER_M=        optional, euros per million input tokens, for the spend line
UXC_PRICE_OUTPUT_PER_M=       optional, euros per million output tokens
UXC_FAKE_AI=0                 1 = use lib/fake-ai.ts fixtures, no network
```

If the price variables are empty, the checklist page shows "[set prices in .env.local]" instead of an amount.
