# 08 · Testing and evaluation

Two different things: **tests** prove the code works. **Evaluation** measures how good the reviews are. The evaluation numbers are what the case study uses.

## Unit tests (Vitest)

* `contrast.ts`: known pairs from docs/04, passing colour suggestion
* `measure.ts`: background and text colour detection on small synthetic images made with sharp (solid colours, anti aliased text rendered with Playwright is fine too)
* `image.ts`: resize factor and coordinate mapping round trips
* `evaluate.ts` and `locate.ts`: zod validation with good, partial and broken fixtures; trimming; dropping invalid boxes
* `place.ts`: dedupe of measured and evaluated duplicates, reading order numbering
* `compare.ts`: fixtures from docs/07
* Rules: threshold overrides

## End to end (Playwright, fake AI mode)

One spec per screen flow, every page checked with `@axe-core/playwright` (zero violations):

1. First use → New review → upload fixture → Reviewing → Review
2. Review: select issues by card and by region badge, filters, push back, undo, keyboard only
3. Form errors: submit empty, wrong type, duplicate version; focus lands on the summary; links move to fields
4. Failed (`fake-timeout`), partial (`fake-unreadable`), no issues (`fake-empty`)
5. Compare two versions created from fixtures
6. Checklist: toggle source, add, edit, move, delete with undo
7. Delete a project: focus starts on "Keep project", Escape keeps it, delete removes files from `data/`
8. Setup screen when the key is missing (start the test server without the env var)

## Evaluation harness (`pnpm eval`, real API calls)

Goal: numbers like "found 17 of 20 planted problems, 2 notes that were not real problems".

### Cases

* `eval/fixtures/*.html`: small, realistic pages, each with planted problems. Claude Code writes 12 of them in M7: login form with placeholder labels, checkout with tiny links, settings page with low contrast, dashboard with 9 equal buttons, error message shown only in red, form without error text, wizard without progress, a clean page with no problems (to count false alarms), and similar
* `eval/fixtures/*.expected.json`: the planted problems, each with `principle_id` and the CSS selector of the element. The script turns selectors into boxes when it takes the screenshot
* `pnpm eval:capture` renders every fixture with Playwright at 1280 × 800, scale 2, into `eval/cases/<name>.png` and `eval/cases/<name>.json` (expected issues with boxes). A planted element's box is the box of what it shows (its text and child boxes), not its CSS box: a full width paragraph with one short line would otherwise never overlap the line a result points at. The JSON also lists every control on the page, for `pnpm eval:measured`
* The owner can add real cases by hand: a PNG and a JSON with expected issues and boxes

### Scoring

For each case, run the real pipeline (both calls) and match results to expected issues with the same matcher as Compare (docs/07).

* **Found**: expected issue matched
* **Missed**: expected issue not matched
* **Unexpected**: result not matched. Not automatically wrong: the report lists them so the owner can mark each as "real" or "invented" in `eval/runs/<date>.review.json`, and the next report counts them

Report `eval/runs/<date>.md`: model, date, per case found / missed / unexpected, totals, recall (found ÷ expected), measured vs evaluated split, average time and tokens per review, and the list of unexpected notes for review. Run each case 3 times and report the spread, because answers vary between runs.

Never put numbers from a report into the UI or docs automatically. The owner copies them into the case study.

`pnpm eval --report eval/runs/<date>.results.json` makes the report again from the saved results and the verdicts, without calling Claude. `pnpm eval --case <name> --runs <n>` runs a subset. With `UXC_FAKE_AI=1` the harness runs on fixture answers; those files are named `<date>-fake-ai` and the report says its numbers mean nothing.

### Measured checks only (`pnpm eval:measured`, no key)

Scores only contrast and text size on every case, with no Claude call: tesseract.js finds the text lines and the docs/04 code measures them from the pixels, exactly as in a live review without a key. Target size is left out because it needs Claude call 1 to find the controls. Rules of a first run checklist, the same matcher as `pnpm eval`. The checks are deterministic, so one run per case. Writes `eval/runs/<date>-measured.md` with found, missed and unexpected per check, per case and in total.
