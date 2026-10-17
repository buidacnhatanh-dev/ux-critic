/**
 * pnpm demo:capture
 *
 * Renders the demo fixtures with Playwright at 1280 × 800, scale 2, into public/demo/<name>.png,
 * and writes demo/captures/<name>.json with where things are on the screenshot:
 *
 * - textLines: one box per rendered line of text (stands in for OCR line boxes)
 * - controls: one box per interactive element (stands in for Claude call 1)
 * - expected: the planted issues from eval/fixtures/<name>.expected.json with their boxes
 *
 * This only locates things. Every value (contrast, sizes) is computed from the PNG pixels later by
 * lib/pipeline/measure.ts in scripts/demo-data.ts. The CSS colour and font size recorded here are
 * for the sanity report only and never reach the demo data.
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEMO_FIXTURES = ["checkout-v1", "checkout-v2", "checkout-v3", "signup", "dashboard"];
export const VIEWPORT = { width: 1280, height: 800 };
export const SCALE = 2;

const root = path.resolve(import.meta.dirname, "..");

type CssBox = { x: number; y: number; w: number; h: number };
type Located = {
  textLines: { label: string; box: CssBox; cssColor: string; cssFontSize: number }[];
  controls: { label: string; role: string; box: CssBox }[];
  expected: { selector: string; box: CssBox | null }[];
};

/** Runs in the page. Keep it free of imports and outer variables. */
function locate(selectors: string[]): Located {
  const visible = (el: Element) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0;
  };
  const toBox = (r: { left: number; top: number; width: number; height: number }) => ({
    x: r.left,
    y: r.top,
    w: r.width,
    h: r.height,
  });
  const union = (rects: { left: number; top: number; right: number; bottom: number }[]) => {
    if (rects.length === 0) return null;
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };

  // Text lines: group the text nodes of each element, one box per visual line.
  const byElement = new Map<Element, Text[]>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const el = node.parentElement;
    if (!el || !node.textContent?.trim() || !visible(el)) continue;
    if (el.closest("script, style, option")) continue;
    byElement.set(el, [...(byElement.get(el) ?? []), node]);
  }
  const textLines: Located["textLines"] = [];
  for (const [el, nodes] of byElement) {
    const rects: DOMRect[] = [];
    for (const node of nodes) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(r);
    }
    rects.sort((a, b) => a.top - b.top);
    const lines: DOMRect[][] = [];
    for (const r of rects) {
      const line = lines.find((l) => Math.abs(l[0]!.top - r.top) < 2);
      if (line) line.push(r);
      else lines.push([r]);
    }
    const text = nodes
      .map((n) => n.textContent ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    const cs = getComputedStyle(el);
    lines.forEach((line, i) => {
      textLines.push({
        label: lines.length === 1 ? text : `${text} (line ${i + 1})`,
        box: toBox(union(line)!),
        cssColor: cs.color,
        cssFontSize: parseFloat(cs.fontSize),
      });
    });
  }
  // Text shown inside inputs (value or placeholder): the content box of the input.
  for (const input of document.querySelectorAll<HTMLInputElement>("input")) {
    if (["checkbox", "radio", "hidden"].includes(input.type) || !visible(input)) continue;
    const shown =
      input.type === "password" && input.value ? "•".repeat(input.value.length) : input.value;
    const label = shown || input.placeholder;
    if (!label) continue;
    const cs = getComputedStyle(input);
    const r = input.getBoundingClientRect();
    const fontSize = parseFloat(cs.fontSize);
    // Measure the text as a span with the input's font: same line box a text node would get.
    const probe = document.createElement("span");
    probe.textContent = label;
    probe.style.cssText = `position:absolute;left:-9999px;white-space:pre;font:${cs.font}`;
    document.body.append(probe);
    const range = document.createRange();
    range.selectNodeContents(probe);
    const textRect = range.getClientRects()[0]!;
    probe.remove();
    const lineHeight = textRect.height;
    const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    textLines.push({
      label,
      box: { x: left, y: r.top + (r.height - lineHeight) / 2, w: textRect.width, h: lineHeight },
      cssColor: input.value ? cs.color : getComputedStyle(input, "::placeholder").color,
      cssFontSize: fontSize,
    });
  }

  // Controls, as call 1 would return them.
  const controls: Located["controls"] = [];
  const interactive = "a[href], button, input:not([type=hidden]), select, textarea, [role=button]";
  for (const el of document.querySelectorAll<HTMLElement>(interactive)) {
    if (!visible(el)) continue;
    const input = el as HTMLInputElement;
    const label =
      el.getAttribute("aria-label") ??
      (input.labels?.[0]?.innerText ||
        el.innerText ||
        input.placeholder ||
        input.value ||
        el.tagName.toLowerCase());
    controls.push({
      label: label.replace(/\s+/g, " ").trim(),
      role:
        input.type === "checkbox"
          ? "checkbox"
          : el.tagName === "A"
            ? "link"
            : el.tagName.toLowerCase(),
      box: toBox(el.getBoundingClientRect()),
    });
  }

  const expected = selectors.map((selector) => {
    const rects = [...document.querySelectorAll(selector)].map((el) => el.getBoundingClientRect());
    const u = union(rects);
    return { selector, box: u ? toBox(u) : null };
  });

  return { textLines, controls, expected };
}

/** CSS px to image px, rounded outwards. */
function toImageBox(box: CssBox) {
  const x = Math.floor(box.x * SCALE);
  const y = Math.floor(box.y * SCALE);
  return {
    x,
    y,
    w: Math.ceil((box.x + box.w) * SCALE) - x,
    h: Math.ceil((box.y + box.h) * SCALE) - y,
  };
}

async function main() {
  await mkdir(path.join(root, "public/demo"), { recursive: true });
  await mkdir(path.join(root, "demo/captures"), { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  try {
    for (const name of DEMO_FIXTURES) {
      const fixture = path.join(root, "eval/fixtures", `${name}.html`);
      const expected = JSON.parse(
        await readFile(path.join(root, "eval/fixtures", `${name}.expected.json`), "utf8"),
      ) as { issues: { selector: string }[] };
      const page = await context.newPage();
      // Fixtures must render offline: block anything that is not a local file.
      await page.route(/^(?!file:)/, (route) => route.abort());
      await page.goto(pathToFileURL(fixture).href);
      await page.evaluate(() => document.fonts.ready);
      const png = path.join(root, "public/demo", `${name}.png`);
      await page.screenshot({ path: png });
      const located = await page.evaluate(
        locate,
        expected.issues.map((i) => i.selector),
      );
      await page.close();

      const missing = located.expected.filter((e) => !e.box).map((e) => e.selector);
      if (missing.length)
        throw new Error(`${name}: selectors match nothing: ${missing.join(", ")}`);

      const capture = {
        fixture: name,
        width: VIEWPORT.width * SCALE,
        height: VIEWPORT.height * SCALE,
        scale: SCALE,
        textLines: located.textLines.map((l) => ({ ...l, box: toImageBox(l.box) })),
        controls: located.controls.map((c) => ({ ...c, box: toImageBox(c.box) })),
        expected: located.expected.map((e) => ({ selector: e.selector, box: toImageBox(e.box!) })),
      };
      await writeFile(
        path.join(root, "demo/captures", `${name}.json`),
        `${JSON.stringify(capture, null, 2)}\n`,
      );
      console.log(
        `${name}: ${capture.textLines.length} text lines, ${capture.controls.length} controls → public/demo/${name}.png`,
      );
    }
  } finally {
    await browser.close();
  }
}

await main();
