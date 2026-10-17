import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
