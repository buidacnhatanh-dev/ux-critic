# 03 · Review pipeline

One review runs four steps. The Reviewing screen shows them in this order:

| Step | Screen label | What happens | On failure |
|---|---|---|---|
| prepare | Screenshot loaded · `<w> × <h> px` | sharp loads the file, stores a PNG copy, makes the image for Claude | status `failed`, Review failed screen |
| measure | Measured contrast and sizes · `<n> problems found by measuring` | OCR text lines, Claude call 1 (locate controls), contrast and size maths, save measurements and measured issues | if call 1 fails: skip target sizes, keep contrast and text size, continue |
| evaluate | Evaluating against principles · `<sources summary>` | Claude call 2 with the screenshot, context, enabled principles, rules and measured results | timeout or network: status `failed` (measured results kept). Unreadable answer: status `partial` |
| place | Placing notes on the screenshot | map boxes to original pixels, drop duplicates, number in reading order | should not fail; if it does, status `partial` |

## Image preparation (lib/pipeline/image.ts)

* Accept PNG, JPEG, WebP. Reject anything else before upload (Form errors screen)
* Store the original as PNG in `data/screenshots/<version id>.png`
* For Claude: resize so the long edge is at most 2576 px (the high resolution limit for current models in the vision docs). Keep the factor `f = original / sent`. Claude returns pixel coordinates relative to the image it received, so every box from Claude is multiplied by `f`
* If the base64 payload is larger than 9 MB, send JPEG at quality 90 instead of PNG
* Never send images with more than 8000 px on a side; downscale first

## Claude call 1: locate controls (lib/pipeline/locate.ts)

Purpose: find interactive controls so code can measure their size. Text is found by OCR, not by Claude.

System prompt:

```
You find interactive controls in a screenshot of a user interface.
Return every button, link, text input, select, checkbox, radio, toggle, tab and icon button you can see.
For each, give a short label (its visible text, or what the icon means) and a tight bounding box in pixels of this image: x, y of the top left corner, width, height.
The box covers the visible control, including its border or background, not the surrounding whitespace.
Links inside running text count. Decorative images do not.
Return only what you can see. Do not guess hidden elements.
```

Output schema (`output_config.format`, type `json_schema`):

```json
{
  "type": "object",
  "properties": {
    "controls": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role": { "type": "string", "enum": ["button","link","input","select","checkbox","radio","toggle","tab","icon_button","other"] },
          "label": { "type": "string" },
          "x": { "type": "integer" }, "y": { "type": "integer" },
          "width": { "type": "integer" }, "height": { "type": "integer" }
        },
        "required": ["role","label","x","y","width","height"],
        "additionalProperties": false
      }
    }
  },
  "required": ["controls"],
  "additionalProperties": false
}
```

Structured outputs do not support numeric limits, so validate with zod after parsing: integers at least 0, boxes inside the image, width and height at least 4. Drop invalid items instead of failing the whole call.

## Claude call 2: evaluate (lib/pipeline/evaluate.ts)

Request: image block first, then one text block with the context below. `max_tokens` 4000.

System prompt (build from parts, only include enabled sources):

```
You are a senior UX designer reviewing one screen. You evaluate it against named principles only.

Principles you may use (id: name: what it means):
<one line per enabled principle from docs/05-principles.md>
<one line per enabled evaluated rule: rule:<id>: <text>>

Rules for your notes:
1. Only report problems you can see in this screenshot. If something is fine, say nothing about it.
2. Every note uses exactly one principle id from the list.
3. At most 8 notes. Prefer fewer, more important notes.
4. Severity: high = blocks or misleads people, medium = slows people down or causes errors, low = polish.
5. Confidence: high = clearly visible, medium = likely but depends on context you cannot see, low = a guess.
6. Do not repeat problems that were already measured (listed below).
7. Region: the smallest box in pixels of this image that shows the problem. Use null only if the problem is the whole screen.
8. Plain language. Title under 8 words. Detail under 40 words. One concrete fix under 30 words.
9. If you find no problems, return an empty list.
```

User text block:

```
What this screen is for: <context or "Not given">
Already measured (do not repeat):
<one line per failing measurement: kind, label, value, threshold>
```

Output schema:

```json
{
  "type": "object",
  "properties": {
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "principle_id": { "type": "string", "enum": ["<filled at runtime with the enabled ids>"] },
          "title": { "type": "string" },
          "detail": { "type": "string" },
          "fix": { "type": "string" },
          "severity": { "type": "string", "enum": ["high","medium","low"] },
          "confidence": { "type": "string", "enum": ["high","medium","low"] },
          "region": {
            "anyOf": [
              { "type": "null" },
              { "type": "object",
                "properties": { "x": {"type":"integer"}, "y": {"type":"integer"}, "width": {"type":"integer"}, "height": {"type":"integer"} },
                "required": ["x","y","width","height"], "additionalProperties": false }
            ]
          }
        },
        "required": ["principle_id","title","detail","fix","severity","confidence","region"],
        "additionalProperties": false
      }
    }
  },
  "required": ["issues"],
  "additionalProperties": false
}
```

After parsing, validate with zod (lengths, box inside image, at most 8 items). Trim over long text rather than failing. If the response cannot be parsed or fails validation entirely, set status `partial`, keep measured results and store the raw text in `reviews.error` for the technical details.

## Placing notes (lib/pipeline/place.ts)

1. Map every box to original pixels (multiply by `f`) and clamp to the image
2. Measured issues come from failing measurements (see docs/04). If an evaluated issue has the same WCAG principle as a measured one and their boxes overlap (IoU at least 0.3), drop the evaluated one
3. Sort all issues top to bottom, then left to right (by box y, then x; null regions last) and number them 1…n
4. Save, set status `done` (or `partial` if evaluate failed), set `finished_at`, store token usage

## Timeouts and retries

* Each Claude call: timeout `UXC_TIMEOUT_MS` (default 60 s). One automatic retry on network errors and 5xx, never on 4xx
* "Try again" on the Review failed screen starts a new review for the same version and reuses the stored screenshot
* "Retry evaluation" on the partial screen reruns only step evaluate and place
* "Cancel review" aborts the running call (AbortController) and returns to New review with the form filled in

## No API key

If `ANTHROPIC_API_KEY` is missing, every page redirects to `/setup`, except when the owner chose "Continue with measured checks only" (stored in a cookie). In that mode the pipeline skips call 1 and call 2, so only OCR based checks run, and the Review screen shows a small note: "Evaluation is off. Connect Claude to turn it on." A second note says target sizes weren't measured, because Claude finds the controls before code measures them.

## Fake AI mode

`UXC_FAKE_AI=1` makes call 1 and call 2 return fixtures from `lib/fake-ai.ts` after a 500 ms delay. Fixtures include: a normal result, an empty result, an unreadable result and a timeout, chosen by the screenshot file name (`fake-empty`, `fake-unreadable`, `fake-timeout`). `fake-slow` returns the normal result of call 2 after 8 seconds (call 1 answers at the usual speed), so tests can press Cancel review. All Playwright tests use this mode.
