import { skippedCheckNotes } from "./skipped-checks";

describe("skippedCheckNotes", () => {
  it("is empty when every check ran (and for demo reviews)", () => {
    expect(skippedCheckNotes(undefined)).toEqual([]);
    expect(skippedCheckNotes([])).toEqual([]);
  });

  it("says why target sizes were not measured", () => {
    const [noKey] = skippedCheckNotes([
      { check: "target_size", reason: "no_claude", detail: null },
    ]);
    expect(noKey!.text).toMatch(/^Target sizes weren't measured: Claude finds the controls/);
    expect(noKey!.text).toContain("Contrast and text size were measured from pixels.");
    const [failed] = skippedCheckNotes([
      { check: "target_size", reason: "failed", detail: "503 error: overloaded" },
    ]);
    expect(failed!.text).toMatch(/because finding the controls failed/);
    expect(failed!.detail).toBe("503 error: overloaded");
  });

  it("says when the text could not be read, and then not that it was measured", () => {
    const [text, target] = skippedCheckNotes([
      { check: "text", reason: "failed", detail: "crash" },
      { check: "target_size", reason: "no_claude", detail: null },
    ]);
    expect(text!.text).toMatch(/^Contrast and text size weren't measured/);
    expect(target!.text).not.toContain("were measured");
  });
});
