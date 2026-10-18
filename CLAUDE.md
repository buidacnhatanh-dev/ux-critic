# UX Critic: project rules for Claude Code

UX Critic is a design review tool with two modes (see `docs/10-demo-mode.md`): an online **demo** with prepared sample reviews that anyone can click through, and a **live** mode on the owner's laptop that reviews any screenshot with Claude. You drop in a screenshot of a screen you designed. Code measures facts from the pixels (contrast, sizes). Claude evaluates the screen against named UX principles. The owner can push back on any note and compare versions over time.

Full specs live in `docs/`. The visual source of truth is `design/*.png` (15 screens). `design/source/*.html` holds the same screens as static HTML, useful for exact spacing, colours and copy. Treat those files as reference, not code to copy.

Read `docs/00-overview.md`, `docs/01-architecture.md`, `docs/10-demo-mode.md` and `docs/03-review-pipeline.md` before writing any code. Read the matching section of `docs/06-screens.md` before building a screen.

## Stack (do not swap without asking)

* pnpm, Node LTS, TypeScript strict
* Next.js (App Router) with React Server Components and Route Handlers. Live mode runs locally with `pnpm dev`. Demo mode is deployed to Vercel
* Own small component set in `components/ui/` and design tokens as CSS variables in `app/tokens.css` (see `docs/01-architecture.md`). Styling with CSS Modules. No Tailwind, no CSS in JS, no component library
* Fonts: Fontsource for Atkinson Hyperlegible Next (body, `@fontsource/atkinson-hyperlegible-next`), Overpass (headings) and JetBrains Mono. Never load fonts from Google servers
* Font weights only through the tokens in `app/tokens.css`: `--weight-regular` (400, body), `--weight-medium` (500, inline emphasis), `--weight-semibold` (600, labels, buttons, badges, pills), `--weight-heading` (600, Overpass headings). Never a raw number
* Fixture fonts (dev dependencies, used only in `eval/fixtures/` so the sample products look unlike UX Critic; each checked to keep the docs/04 text size estimate within 1 px): `@fontsource/cormorant-garamond` and `@fontsource/figtree` (coffee shop checkout), `@fontsource/rubik` (fitness sign up), `@fontsource/barlow-semi-condensed` (logistics dashboard). Fixtures never use #1D4ED8, Atkinson Hyperlegible (Next or original) or Overpass
* SQLite with `better-sqlite3` and Drizzle ORM. Database and screenshots live in `data/` (gitignored)
* `@anthropic-ai/sdk` for Claude. Structured answers with `output_config.format` (JSON schema), validated again with `zod`
* `sharp` for reading and resizing images, `tesseract.js` for finding text on screenshots, with its language data from `@tesseract.js-data/eng` and `@tesseract.js-data/deu` (never downloaded at runtime)
* Vitest and Testing Library, Playwright with `@axe-core/playwright`

## Product rules (hard requirements)

* **Measured means measured.** Only label a note "Measured" when the value was computed from pixels by code. Everything Claude says is "Evaluated"
* **Every evaluated note names its principle** from `docs/05-principles.md` and shows "Based on <principle>"
* **No overall score.** Progress is shown as fixed, still open and new issues
* **Show confidence** for evaluated notes (high, medium, low). Measured notes say "Measured from pixels"
* **Regions are approximate.** The UI says so
* **Never lose work.** Measured results are saved before the evaluation starts. A failed evaluation never deletes them
* **Wording:** use "Measured", "Evaluated", "Based on", "Confidence". Do not show the words "AI judgement" anywhere in the UI

## Modes (hard requirements)

* Every screen reads and writes data only through `DataClient` (`docs/10-demo-mode.md`). No screen imports the database or the pipeline directly
* Demo mode never calls the Claude API, never opens the database, and every API route returns 404 in demo mode
* The public deployment runs with `UXC_MODE=demo` and no API key. Never add a key to Vercel
* Demo mode always shows the Demo pill and where the sample reviews came from

## Privacy (hard requirements)

* Screenshots go to the Claude API and nowhere else. No analytics, no telemetry, no third party requests
* `ANTHROPIC_API_KEY` is read on the server only and never sent to the browser
* `data/`, `.env*` and `eval/runs/` are gitignored

## Accessibility (WCAG 2.2 AA)

* Visible focus on everything focusable, using the focus ring from `docs/01-architecture.md`. Never `outline: none` without it
* Text contrast at least 4.5 : 1, controls and focus at least 3 : 1
* Targets at least 44 by 44 CSS px
* Never colour alone: severity, status and errors always have text, and an icon where the design shows one
* Form errors appear on submit, not while typing. An error summary at the top links to each field, and focus moves to it
* Progress and results are announced through the shared `Announcer` component, not ad hoc live regions
* Dialogs use the `Dialog` component (native `<dialog>` with `showModal()`). Destructive dialogs focus the safe action first, and focus returns to the button that opened them
* Respect `prefers-reduced-motion` (the scan line on the Reviewing screen does not animate when reduced)

## Definition of done for any milestone

1. Screens match `design/` and the behaviour in `docs/06-screens.md`
2. Unit tests for every pure function (contrast, matching, parsing, schema validation)
3. Playwright test for the main flow of every screen touched, run in fake AI mode (`UXC_FAKE_AI=1`), with zero axe violations
4. No real API calls in tests. Real calls only in `pnpm eval`
5. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and `pnpm build` pass
6. A short note in `docs/CHANGELOG.md` listing what was built and any decision you had to make

## Commands

```
pnpm install
pnpm dev            # http://localhost:3000
pnpm db:migrate     # create or update data/uxcritic.db
pnpm test           # vitest
pnpm test:e2e       # playwright, fake AI mode
pnpm eval           # real Claude calls against eval/cases, writes eval/runs/<date>.md
pnpm demo:capture   # render demo screens from eval/fixtures to public/demo/*.png
pnpm demo:data      # measure the demo PNGs, write demo/data.json (source: handwritten)
pnpm demo:build     # live mode only: run the real pipeline on demo screens, write demo/data.json
pnpm lint
pnpm typecheck
pnpm build
```

## Never

* Invent results, counts or quotes. Use real data or clearly marked sample data in tests and fixtures only
* Add a dependency not listed above without asking
* Commit `data/`, keys or eval runs
* Call the Claude API from the browser
* Use `tabindex` greater than 0
* Show a number to the user that the code did not compute or the API did not return
