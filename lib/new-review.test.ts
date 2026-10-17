import {
  errorSummaryTitle,
  fileError,
  fileSize,
  fileTypeName,
  nextVersionName,
  projectNameError,
  suggestScale,
  versionError,
} from "./new-review";

describe("new review rules", () => {
  it("suggests the next free version name", () => {
    expect(nextVersionName([])).toBe("v1");
    expect(nextVersionName(["v1", "V2"])).toBe("v3");
    expect(nextVersionName(["v2"])).toBe("v1");
  });

  it("suggests 2× above 2000 px wide (docs/04)", () => {
    expect(suggestScale(2560)).toBe(2);
    expect(suggestScale(2000)).toBe(1);
    expect(suggestScale(1280)).toBe(1);
  });

  it("formats file sizes", () => {
    expect(fileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(fileSize(830 * 1024)).toBe("830 KB");
    expect(fileSize(10)).toBe("1 KB");
  });

  it("names file types", () => {
    expect(fileTypeName({ name: "a.pdf", type: "application/pdf" })).toBe("PDF");
    expect(fileTypeName({ name: "design.sketch", type: "" })).toBe("SKETCH");
    expect(fileTypeName({ name: "noext", type: "" })).toBe("file without a type");
  });

  it("checks the screenshot: missing, wrong type, too large", () => {
    expect(fileError(null)?.summary).toBe("Add a screenshot.");
    expect(fileError({ name: "checkout-v2.pdf", type: "application/pdf", size: 100 })).toEqual({
      field: "file",
      summary: "The file is a PDF. Use a PNG, JPG or WebP image.",
      message:
        "This file is a PDF. Export the screen as a PNG, JPG or WebP image, or take a screenshot of it.",
    });
    expect(fileError({ name: "x.svg", type: "image/svg+xml", size: 1 })?.summary).toBe(
      "The file is an SVG. Use a PNG, JPG or WebP image.",
    );
    expect(fileError({ name: "big.png", type: "image/png", size: 21 * 1024 * 1024 })?.summary).toBe(
      "The file is 21.0 MB. Use one up to 20 MB.",
    );
    expect(fileError({ name: "ok.webp", type: "image/webp", size: 20 * 1024 * 1024 })).toBeNull();
  });

  it("checks the project name", () => {
    expect(projectNameError("  ", [])?.field).toBe("project-name");
    expect(projectNameError("checkout PRACTICE", ["Checkout practice"])?.summary).toBe(
      'A project called "checkout PRACTICE" already exists.',
    );
    expect(projectNameError("New one", ["Checkout practice"])).toBeNull();
  });

  it("checks the version name and suggests a free one", () => {
    expect(versionError("v2", ["v1", "v2"])).toEqual({
      field: "version",
      summary: '"v2" already exists in this project. Try "v3".',
      message: '"v2" already exists. Try "v3".',
    });
    expect(versionError("", ["v1"])?.message).toBe('Give the version a name, like "v2".');
    expect(versionError("v3", ["v1", "v2"])).toBeNull();
  });

  it("titles the error summary", () => {
    expect(errorSummaryTitle(1)).toBe("One thing needs fixing");
    expect(errorSummaryTitle(2)).toBe("Two things need fixing");
    expect(errorSummaryTitle(12)).toBe("12 things need fixing");
  });
});
