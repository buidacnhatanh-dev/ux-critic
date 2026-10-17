# 09 · Milestones and prompts

One milestone per Claude Code session (or `/clear` between them). Paste the prompt, review what it built, run it yourself, then commit before the next one. Each milestone ends with the Definition of done in CLAUDE.md.

The order builds the **online demo first** (M0 to M4, no API key, no cost), then **live mode** (M5 to M7), then deploys.

---

## M0 · Scaffold, tokens, components, modes

> Read CLAUDE.md, docs/00-overview.md, docs/01-architecture.md, docs/02-data-model.md and docs/10-demo-mode.md. Scaffold the project exactly as described: Next.js App Router with TypeScript strict, pnpm, ESLint, Prettier, Vitest, Playwright with @axe-core/playwright, Fontsource fonts and .env.example. Create app/tokens.css and every component in components/ui/ from docs/01, each with a unit test and a preview page at /dev/ui (development only) showing every variant and state. Create the DataClient interface and the mode switch from docs/10 with empty DemoClient and LiveClient. Build the sidebar shell from design/01-Main.png, including the Demo pill, "How this demo works" dialog and "Reset demo" button, and empty pages for every route. Do not build the database or the pipeline yet.

**Done when** `pnpm dev` shows the shell in demo mode, /dev/ui shows every component with a visible focus ring and passes axe, and lint, typecheck, test and build pass.

---

## M1 · Demo data

> Read docs/04-measured-checks.md, docs/05-principles.md, docs/08-testing-and-evaluation.md (fixtures part) and docs/10-demo-mode.md (demo data). Write the eval/fixtures HTML pages needed for the three sample projects in docs/10 (Checkout practice v1 to v3, Sign up form, Analytics dashboard), each with its expected issues JSON. Add pnpm demo:capture to render them to public/demo/*.png. Write lib/contrast.ts and the contrast and size measuring from docs/04 with their unit tests, and use them in a script to compute the measured values for the demo screens. Then write demo/data.json with source "handwritten": measured issues from the real computed values, and evaluated issues written from the planted problems, using principle ids from docs/05. Implement DemoClient with the localStorage overlay and reset. Never type a measured number by hand.

---

## M2 · Demo screens: Projects, Review, Project history, Compare

> Read docs/06-screens.md sections 1, 2, 4, 5, 7 and 12, docs/07-compare.md and docs/10. Build lib/compare.ts with all unit test fixtures from docs/07. Build Projects (1), Project history (2), Review (4) with regions, selection in both directions, filters, push back and undo, Compare (5), First use (7) and No issues found (12), all reading through DataClient in demo mode. Match the designs. Write Playwright flows for each in demo mode, keyboard only for the Review screen, with axe.

---

## M3 · Demo: New review, checklist, dialogs

> Read docs/06 sections 3, 6, 9, 13, 14 and 15, and docs/10. Build New review in both forms: the demo sample picker and the live upload form with Scale, paste, validation and the Form errors state (13). In demo, Start review shows Reviewing (9) with simulated steps and then the prepared review. Build My checklist (6), Edit a rule (14) and Delete a project (15) with the Dialog component and focus on "Keep project". Add the /states page from docs/10 showing Connect Claude (8), Review failed (10) and Evaluation unreadable (11) with sample data. Playwright flows for all of them in demo mode.

---

## M4 · Deploy the demo

> Read docs/10 (deployment). Prepare the Vercel deployment in demo mode: no database, no pipeline, no API routes in the bundle, og:image, README section "Run the demo". Add the production smoke test from docs/10. Give me the exact steps to connect the repo to Vercel and set UXC_MODE=demo; do not deploy yourself.

**After M4 · You:** connect the GitHub repo to Vercel, set `UXC_MODE=demo`, deploy, and open the link on your phone and laptop. This is the link for your portfolio.

---

## M5 · Live mode: database, upload, evaluation

> Read docs/02-data-model.md and docs/03-review-pipeline.md. Add Drizzle with better-sqlite3 and migrations for every table in docs/02 (with the six seed rules), the API routes from docs/01, and LiveClient. Build the pipeline steps prepare, evaluate and place with Claude call 2, output_config.format and zod validation, polling, fake AI mode with all fixtures, timeouts, retry, cancel and server restart handling. Real Connect Claude (8), Review failed (10) and No issues found states in live mode. Unit tests for validation and placing; Playwright flows in fake AI mode. Demo mode must keep working and must not import any of this.

**Check yourself (costs a few cents):** add your key, run one real review on a NeighborGoods screen. Do you agree with the notes?

---

## M6 · Live mode: measured checks

> Read docs/04-measured-checks.md. Add the measure step: tesseract.js text lines, contrast, estimated text size, Claude call 1 to locate controls with code based target size, the measurements table, measured issues, passing the measured results into the evaluation prompt, Evaluation unreadable (11) with Retry evaluation, and the no key fallback. Reuse the measuring code from M1.

---

## M7 · Evaluation and real demo data

> Read docs/08-testing-and-evaluation.md and docs/10 (pnpm demo:build). Build pnpm eval:capture and pnpm eval with scoring, 3 runs per case and the markdown report, then pnpm demo:build. Do not run either yourself; I will run them with my key. Finally go through every screen against its design, fix differences, run the full test suite with axe, and finish the README: the two modes, setup, how a review works, measured vs evaluated, and how to run the evaluation.

---

## After M7 · You

* Run `pnpm eval` (about 1 to 2 dollars), read the unexpected notes, mark them real or invented, run the report again. These numbers go into the case study
* Run `pnpm demo:build`, read the new demo reviews, commit, redeploy. The demo badge then says the reviews were generated by Claude
* Review one of your own designs live, fix something, review v2, compare
