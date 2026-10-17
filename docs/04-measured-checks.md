# 04 · Measured checks

Everything here is plain code. No Claude output is trusted for a number; Claude only helps find where controls are, and code measures them.

## Scale

Screenshots from Retina screens have 2 device pixels per CSS pixel. The New review form asks for the scale (1×, 2×, 3×). Suggest 2× when the image is wider than 2000 px, otherwise 1×. All sizes are reported in CSS px: `css = device / scale`.

## Text lines (lib/pipeline/ocr.ts)

* Run tesseract.js (English and German) on the original image, at line level
* Keep lines with confidence at least 60 and at least 2 characters
* Each line gives text and a bounding box

## Contrast (lib/contrast.ts, lib/pipeline/measure.ts)

For each text line box:

1. Read the pixels inside the box (sharp raw RGB)
2. Background colour: the most common colour in a 2 px ring just outside the box (quantise to 5 bits per channel before counting)
3. Text colour: among pixels inside the box, take the 10 % furthest from the background in luminance, then their median colour (this ignores anti aliasing at glyph edges)
4. Ratio with the WCAG 2.2 formula: relative luminance with the sRGB transfer, `(L1 + 0.05) / (L2 + 0.05)`
5. Threshold 4.5, or 3.0 when the line is large text (estimated font size at least 24 CSS px). Bold detection is out of scope; note this in the issue detail when the ratio is between 3.0 and 4.5
6. Round to 2 decimals for display ("1.85 : 1")

Unit test the formula with known pairs: `#B9BFC8` on white is 1.85, `#5B6472` on white is 5.98, `#15181D` on white is 17.79, `#2B2F36` on white is 13.44.

The `contrast_min` rule threshold replaces 4.5 if the owner set a stricter one.

## Text size

Estimated font size in CSS px = OCR line box height ÷ scale ÷ 1.2. Report as "about 13 px". Fail when below the `text_size_min` rule (default 16) and the line is longer than 20 characters (so labels and captions are not flagged as body text). Severity low. Detail must say the size is estimated from the text line height.

### Accuracy of the text size estimate

The estimate depends on the font, because `line box height ÷ scale ÷ 1.2` assumes the font's line box is 1.2 times its size. Tested in Chromium at 12 to 40 px with the text line box Chromium reports for each line:

* Within 1 px: Atkinson Hyperlegible, Overpass, Cormorant Garamond, Figtree, Rubik and Barlow Semi Condensed (the fixture fonts), also Inter Tight, Bitter, Zilla Slab, Libre Franklin and Varela Round
* Arial and Helvetica read 1 to 2 px low, so 16 px body text in them can be reported as "about 15 px" and fail the 16 px rule
* Fonts with tall line boxes read high (Nunito, Source Serif 4, Playfair Display by 4 to 5 px at 40 px), so small text in them can pass when it should not
* Snapping a box to whole screenshot pixels adds up to 1 image px, which is 0.42 CSS px at scale 2. Fredoka was dropped from the fixtures for this: +0.67 px on its own, 1.08 px after snapping

The demo fixtures only use fonts that stay within 1 px after snapping. Real screenshots go through OCR, whose line boxes are tighter than Chromium's line boxes, so check this formula against real OCR boxes in M6 before trusting text size results on other fonts.

## Target size (needs Claude call 1)

For each control from call 1:

1. Expand the box by 8 px on each side
2. Find the background colour (most common colour on the expanded box's border)
3. Tight box = bounding box of pixels that differ from the background by more than a small threshold (delta E 2000 above 6, or a simpler RGB distance above 30 if easier). For text links without a background this becomes the text bounds, which is the real tap area
4. Size in CSS px = tight box ÷ scale
5. Fail when width or height is below 24 (WCAG 2.5.8, severity medium). Also fail when below the `target_size_min` rule (default 44, severity low, principle `rule:<id>`). Report the smaller dimension: "14 px tall, needs at least 24"

## Measured issue text

| kind | title | detail | fix |
|---|---|---|---|
| contrast | "<label>" is too faint (or "Text is too faint" when the label is long) | `"<label>" measures <ratio> : 1 on <bg hex>. Text needs at least <threshold> : 1.` | Suggest the nearest darker (or lighter on dark backgrounds) colour along the same hue that passes, with its ratio |
| text_size | Body text is small | `About <n> px. My checklist asks for at least <threshold> px. Estimated from the text line height.` | `Use at least <threshold> px for body text.` |
| target_size | "<label>" is too small to tap | `<n> px <tall/wide>. Targets need at least <threshold> by <threshold> px.` | `Make it at least <threshold> px <tall/wide>, ideally 44 px.` |

Principle ids: contrast `wcag-1.4.3`, target size `wcag-2.5.8` or the rule id, text size the rule id.

## Suggesting a passing colour

Convert the text colour to OKLCH, lower (or raise) lightness in 1 % steps keeping hue and chroma until the ratio passes, return the hex and the new ratio. Unit test with `#B9BFC8` on white (must return a colour with at least 4.5 : 1).
