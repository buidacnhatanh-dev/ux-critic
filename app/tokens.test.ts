import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contrastRatio, parseHex } from "@/lib/contrast";

/** Every CSS and TSX file under app/ and components/, except the tokens themselves. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(css|tsx)$/.test(entry.name) && entry.name !== "tokens.css" ? [path] : [];
  });
}

describe("font weights", () => {
  const tokens = readFileSync("app/tokens.css", "utf8");

  it("defines the four weight tokens", () => {
    for (const name of ["regular", "medium", "semibold", "heading"]) {
      expect(tokens).toMatch(new RegExp(`--weight-${name}: \\d{3};`));
    }
  });

  it("are only set through the tokens, never as raw numbers", () => {
    const raw = [...sources("app"), ...sources("components")].flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ file, line: i + 1, text: line }))
        .filter(({ text }) => /font-weight:\s*\d|fontWeight[=:]\s*["{]?\d/.test(text)),
    );
    expect(raw).toEqual([]);
  });
});

describe("colour contrast of the tokens", () => {
  const tokens = readFileSync("app/tokens.css", "utf8");
  const colour = (name: string) => {
    const match = tokens.match(new RegExp(`--color-${name}: (#[0-9a-fA-F]{6});`));
    if (!match) throw new Error(`--color-${name} is not a hex colour in tokens.css`);
    return parseHex(match[1]!);
  };
  const ratio = (fg: string, bg: string) => contrastRatio(colour(fg), colour(bg));

  it("primary text passes 4.5 : 1 on every background it sits on", () => {
    for (const bg of ["bg", "surface", "primary-tint", "primary-soft"]) {
      expect(ratio("primary", bg), `primary on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("white text passes 4.5 : 1 on primary buttons", () => {
    expect(ratio("on-dark", "primary")).toBeGreaterThanOrEqual(4.5);
  });

  it("ink text passes 4.5 : 1 on the primary tints", () => {
    expect(ratio("ink", "primary-tint")).toBeGreaterThanOrEqual(4.5);
    expect(ratio("ink", "primary-soft")).toBeGreaterThanOrEqual(4.5);
  });

  it("primary passes 3 : 1 as a control colour (filled buttons, selected borders)", () => {
    expect(ratio("primary", "bg")).toBeGreaterThanOrEqual(3);
  });
});
