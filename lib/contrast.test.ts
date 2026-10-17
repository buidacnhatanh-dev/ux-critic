import {
  contrastRatio,
  contrastThreshold,
  formatRatio,
  oklchToRgb,
  parseHex,
  relativeLuminance,
  rgbToOklch,
  roundRatio,
  suggestPassingColour,
  toHex,
} from "./contrast";

const WHITE = parseHex("#FFFFFF");

describe("parseHex and toHex", () => {
  it("round trips 6 and 3 digit colours", () => {
    expect(toHex(parseHex("#1d4ed8"))).toBe("#1D4ED8");
    expect(toHex(parseHex("fff"))).toBe("#FFFFFF");
  });

  it("rejects non colours", () => {
    expect(() => parseHex("#12345")).toThrow();
    expect(() => parseHex("blue")).toThrow();
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance(parseHex("#000"))).toBe(0);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
  });
});

describe("contrastRatio (known pairs from docs/04)", () => {
  it.each([
    ["#B9BFC8", 1.85],
    ["#5B6472", 5.98],
    ["#15181D", 17.79],
    ["#2B2F36", 13.44],
  ])("%s on white is %s", (hex, expected) => {
    expect(roundRatio(contrastRatio(parseHex(hex), WHITE))).toBe(expected);
  });

  it("is 21 for black on white and symmetric", () => {
    const black = parseHex("#000");
    expect(contrastRatio(black, WHITE)).toBeCloseTo(21, 10);
    expect(contrastRatio(WHITE, black)).toBe(contrastRatio(black, WHITE));
  });

  it("is 1 for the same colour", () => {
    expect(contrastRatio(WHITE, WHITE)).toBe(1);
  });
});

describe("formatRatio", () => {
  it("shows two decimals", () => {
    expect(formatRatio(1.8512)).toBe("1.85 : 1");
    expect(formatRatio(21)).toBe("21.00 : 1");
  });
});

describe("contrastThreshold", () => {
  it("is 4.5 for normal text and 3 for large text", () => {
    expect(contrastThreshold(16)).toBe(4.5);
    expect(contrastThreshold(23.9)).toBe(4.5);
    expect(contrastThreshold(24)).toBe(3);
  });

  it("uses a stricter rule threshold, never a weaker one", () => {
    expect(contrastThreshold(16, 7)).toBe(7);
    expect(contrastThreshold(16, 3)).toBe(4.5);
    expect(contrastThreshold(30, 4.5)).toBe(4.5);
    expect(contrastThreshold(16, null)).toBe(4.5);
  });
});

describe("OKLCH conversion", () => {
  it.each(["#B9BFC8", "#1D4ED8", "#B42318", "#15181D", "#FFFFFF"])("round trips %s", (hex) => {
    expect(toHex(oklchToRgb(rgbToOklch(parseHex(hex))))).toBe(hex);
  });
});

describe("suggestPassingColour", () => {
  it("darkens #B9BFC8 on white until it reaches 4.5 : 1", () => {
    const text = parseHex("#B9BFC8");
    const result = suggestPassingColour(text, WHITE, 4.5)!;
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(parseHex(result.hex), WHITE)).toBe(result.ratio);
    // Nearest: one 1 % step lighter would not pass.
    const lighter = rgbToOklch(parseHex(result.hex));
    const back = oklchToRgb({ ...lighter, l: lighter.l + 0.01 });
    expect(contrastRatio(back, WHITE)).toBeLessThan(4.5);
    // Keeps the hue family: still a cool grey (blue channel highest).
    const rgb = parseHex(result.hex);
    expect(rgb.b).toBeGreaterThanOrEqual(rgb.r);
  });

  it("lightens text on a dark background", () => {
    const dark = parseHex("#15181D");
    const result = suggestPassingColour(parseHex("#4A5260"), dark, 4.5)!;
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    expect(relativeLuminance(parseHex(result.hex))).toBeGreaterThan(
      relativeLuminance(parseHex("#4A5260")),
    );
  });

  it("returns the colour itself when it already passes", () => {
    expect(suggestPassingColour(parseHex("#15181D"), WHITE, 4.5)!.hex).toBe("#15181D");
  });

  it("returns null when nothing can pass", () => {
    expect(suggestPassingColour(parseHex("#777777"), parseHex("#777777"), 21)).toBeNull();
  });
});
