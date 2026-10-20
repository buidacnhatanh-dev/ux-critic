# 06 · Screens

Every screen exists in both modes. Demo mode differences are listed in `docs/10-demo-mode.md`.

Every screen uses the same shell: a sidebar (UX Critic logo, Projects, New review, My checklist, "Private · runs on this laptop") and a main area. On narrow windows the sidebar stacks above the content. The current page has `aria-current="page"`.

Design files: `design/NN-Name.png` and `design/source/NN-Name.html`. Sample data in the designs (Checkout practice, NeighborGoods, FashionFlock, all counts and dates) is illustrative. Show real data from the database.

## Visual basics (from the designs)

* Fonts: Overpass 600 for headings, Atkinson Hyperlegible Next 400 for body text and 600 for labels, buttons, badges and pills, JetBrains Mono for code. Weights come from the `--weight-*` tokens. The PNG designs still show the older, bolder weights
* Colours: ink `#15181D`, secondary text `#4A5260`, borders `#DDE1E7`, surface `#F7F8FA`, primary `#573CFA` with tint `#EEEBFE` and `#F6F5FF`. All of these are tokens in `app/tokens.css`; never use the raw hex in components
* Severity pills: High `#B42318` on `#FEE4E2`, Medium `#7A5600` on `#FFF4D1`, Low `#4A5260` on `#EEF1F5`
* Kind badges: Measured = ink pill with white text. Evaluated = white pill with primary text and primary border
* Region boxes on screenshots: measured = ink, evaluated = primary, pushed back = grey `#8A93A3`. Dashed when not selected, solid 3 px plus a light tint when selected. Number badge at the top left corner
* Cards: 14 px radius, 1.5 px border. Buttons: 8 px radius, at least 44 px tall

## 1 · Projects (`/`) · design 01

* Cards per project: thumbnail of the latest version, name, "v2 · reviewed 14 Oct", severity counts of the latest review, and a trend line when there are two or more versions ("3 fewer issues than v1", green; "2 more issues than v1", amber text; "Same number of issues as v1")
* "Add a project" card links to New review with a new project
* Recent reviews table: date, project, version, issue count, "I disagreed" count, Open link. Latest 10
* When there are no projects, show screen 7 instead

## 2 · Project history (`/projects/[id]`) · design 02

* Breadcrumb, project name, buttons "Compare v<n-1> and v<n>" (only with two or more versions) and "Review a new version"
* Versions list, newest first, latest marked "Latest" with a primary border. Each: thumbnail, name, review date, the context sentence, severity counts, "Open review"
* "Issues per version": a small stacked bar per version (High, Medium, Low), with the total as text and a legend. The bars are decorative (`aria-hidden`); the numbers are in text
* "Where I disagreed": every pushback in this project with the issue title, version, principle and the reason as a quote
* An icon button "Delete project" (trash icon, `aria-label`) at the top right opens screen 15

## 3 · New review (`/new`) · design 03

Fields, in order:

1. Screenshot: drop zone, paste from clipboard (Cmd+V anywhere on the page) and a "Choose a file" button. After choosing, show a thumbnail with name and size and a "Remove" button
2. Project: select of existing projects plus "New project…", which reveals a "Project name" text field
3. Version name: suggest the next free name ("v3")
4. **Scale** (not in the design, add it under Version name): radio group 1× / 2× / 3×, hint "2× for Retina screenshots". Preselect per docs/04
5. "What is this screen for?" optional textarea with hint
6. "Check against": four checkboxes for the sources, defaults from settings, "My checklist" shows the rule count and an Edit link

"Start review" posts the form, then navigates to `/reviews/[id]`. Note under the button: "The screenshot is sent to Claude for the review and saved only on this laptop."

## 4 · Review (`/reviews/[id]`, status done) · design 04

* Breadcrumb, "Review of v1", summary line "5 issues · 1 I disagreed with · reviewed 13 Oct"
* Filter buttons with counts: All, Measured, Evaluated (toggle buttons, `aria-pressed`)
* "Compare with v<n>" link when another version exists
* Left: the screenshot scaled to fit the column (keep aspect ratio), with region boxes positioned in percentages so they scale. Caption: "Highlighted areas are approximate. Select an issue to see where it is."
* Right: issue cards in number order. The card header is a button (`aria-expanded`) with number, title, kind badge, severity pill, "I disagreed" pill when pushed back, and "Based on <principle>"
* Expanded card: detail, "Suggested fix" box, then either:
  * "Measured from pixels" or "Confidence: high" and an "I disagree" button, or
  * the textarea "Why is this not a problem here?" with Cancel and "Save reason" (reason required), or
  * "Why I disagree" box with the reason and Undo
* Selecting a card highlights its region. Clicking a region number badge selects its card. Only one card open at a time
* Keyboard: everything works with Tab and Enter. Region badges are buttons with `aria-label="Issue 2: Labels disappear while typing"`
* When evaluation was off (no key mode), show the note from docs/03 above the list

## 5 · Compare versions (`/projects/[id]/compare?from=&to=`) · design 05

* From and To selects (defaults: the two newest versions)
* Three tiles: Fixed, Still open, New in v<to>, with counts
* Both screenshots side by side with captions "v1 · 5 issues"
* Three lists. Fixed items show the old measured value and the new one when a matching measurement exists ("was 1.85 : 1, labels now 13.44 : 1"). Still open items show "I disagreed in v1: <reason>" when there is a pushback. New items link to their review
* "By severity" table: rows High, Medium, Low, Total; columns per version
* Matching rules: docs/07

## 6 · My checklist (`/checklist`) · design 06

* Principles: three checkboxes (Nielsen, WCAG 2.2 AA, Laws of UX) with a one line description each. Saved immediately, with a toast "Saved"
* My own rules: numbered list, each with text, kind badge and an Edit icon button (`aria-label="Edit rule: <text>"`) that opens screen 14. Drag to reorder is not needed; add "Move up" and "Move down" inside the edit dialog instead
* Add a rule: text field, "Checked by" select (Evaluated, or Measured with a metric and threshold, see docs/02), "Add rule" button
* Connection: model id from env, "Saved in .env.local" or "Missing", and "Spent this month" from token usage times the env prices (or the placeholder from docs/01)

## 7 · First use (`/` with no projects) · design 07

Illustration, "Review your first design", one sentence, "Start a review" button, three numbered steps.

## 8 · Connect Claude (`/setup`) · design 08

Shown when the key is missing. Status pill "No API key found", three steps (create a key, add it to `.env.local`, restart), "Check again" (reloads and checks the env), "Continue with measured checks only" (sets the cookie from docs/03).

## 9 · Reviewing (`/reviews/[id]`, status queued or running) · design 09

* Screenshot on the left with a soft scan line moving down (no animation under reduced motion)
* Step list on the right with done, current (spinner) and waiting icons, labels and details from docs/03
* Announce each finished step politely through `useAnnouncer`
* "Usually 15 to 30 seconds. Measured results are already saved, even if you leave." and "Cancel review"
* Poll every second; switch to the result screen when status changes

## 10 · Review failed (`/reviews/[id]`, status failed) · design 10

Alert box with a human message chosen from the error type (timeout, network, API key rejected, rate limit, unknown), reassurance that the screenshot and settings are saved, "Try again" and "Change settings" (New review prefilled), and a `<details>` with technical details (error message, failed step, whether measured checks finished). Focus moves to the heading.

## 11 · Evaluation unreadable (`/reviews/[id]`, status partial) · design 11

Review screen with only measured issues, a status banner "Measured results are ready. The evaluation came back in a format the app couldn't read, so it isn't shown." with "Retry evaluation", and a dashed placeholder card "Evaluation missing".

## 12 · No issues found (`/reviews/[id]`, done with 0 issues) · design 12

Screenshot without regions, a success card "No issues found", what it was checked against, and the honest line "That doesn't mean there are no problems. An evaluation can miss things, so watching one real person use it is still worth it." Buttons "Compare with v<n>" (if any) and "Back to project", plus "Fixed since v<n>: <count> issues" when there is a previous version.

## 13 · Form errors (`/new` after submit) · design 13

* Error summary at the top (`role="alert"`, focused), heading "One thing needs fixing" or "<n> things need fixing", each error a link to its field
* Each field: error text with icon under it, `aria-invalid`, `aria-describedby`, 2 px red border
* Errors: no file, wrong file type (say which type it was), file larger than 20 MB, project name empty or taken, version name empty or already used ("v2 already exists. Try v3.")
* Errors are shown on submit, then updated as fields are fixed. Never while typing for the first time

## 14 · Edit a rule (dialog on `/checklist`) · design 14

`Dialog` titled "Edit rule": rule textarea, "Checked by" radio group (Measured shows metric select and threshold number field), Move up and Move down, "Delete rule" (text button, red), Cancel, "Save rule". Focus starts in the textarea. Deleting asks nothing extra but shows a toast with Undo for 8 seconds.

## 15 · Delete a project (dialog on `/projects/[id]`) · design 15

`Dialog` (alert dialog) "Delete "<name>"?", lists what gets deleted with real counts (reviews, screenshots, reasons), "You can't undo this.", buttons "Keep project" (focused first) and "Delete project" (red). After deleting: go to Projects and show a toast "Deleted <name>".
