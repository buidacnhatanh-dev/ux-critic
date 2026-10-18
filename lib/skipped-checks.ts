/** Sentences for measured checks that did not run in a live review (docs/03, docs/04). */
import type { SkippedCheck } from "./data/types";

export type SkippedNote = { key: string; text: string; detail: string | null };

export function skippedCheckNotes(skipped: SkippedCheck[] | undefined): SkippedNote[] {
  // Only say contrast and text size were measured when they were.
  const textRan = !(skipped ?? []).some((s) => s.check === "text");
  return (skipped ?? []).map((s) => {
    const key = `${s.check}-${s.reason}`;
    if (s.check === "text") {
      return {
        key,
        text: "Contrast and text size weren't measured, because the text on the screenshot couldn't be read.",
        detail: s.detail,
      };
    }
    if (s.reason === "no_claude") {
      return {
        key,
        text: `Target sizes weren't measured: Claude finds the controls before code measures them.${textRan ? " Contrast and text size were measured from pixels." : ""}`,
        detail: null,
      };
    }
    return {
      key,
      text: `Target sizes weren't measured, because finding the controls failed.${textRan ? " Contrast and text size were measured as usual." : ""}`,
      detail: s.detail,
    };
  });
}
