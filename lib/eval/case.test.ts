import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { evalCaseSchema } from "./case";

const casesDir = path.resolve(__dirname, "../../eval/cases");
const fixturesDir = path.resolve(__dirname, "../../eval/fixtures");

describe("eval cases", () => {
  it("has a valid case for every fixture, with a box for every planted problem", () => {
    const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".html"));
    expect(fixtures.length).toBeGreaterThanOrEqual(12);
    for (const file of fixtures) {
      const name = file.replace(/\.html$/, "");
      const parsed = evalCaseSchema.parse(
        JSON.parse(readFileSync(path.join(casesDir, `${name}.json`), "utf8")),
      );
      const planted = JSON.parse(
        readFileSync(path.join(fixturesDir, `${name}.expected.json`), "utf8"),
      ) as { issues: { id: string }[] };
      expect(parsed.issues.map((i) => i.id)).toEqual(planted.issues.map((i) => i.id));
      expect(parsed.issues.every((i) => i.box)).toBe(true);
      expect(parsed.controls?.length).toBeGreaterThan(0);
    }
  });

  it("accepts a hand made case without controls and refuses a broken one", () => {
    const manual = {
      name: "my-screen",
      width: 2560,
      height: 1600,
      scale: 2,
      issues: [{ id: "x", kind: "evaluated", principle_id: "nielsen-1", box: null }],
    };
    expect(evalCaseSchema.parse(manual).source).toBe("manual");
    expect(() => evalCaseSchema.parse({ ...manual, scale: 4 })).toThrow();
  });

  it("never plants a problem with a principle that does not exist", () => {
    const principles = readFileSync(path.resolve(__dirname, "../../docs/05-principles.md"), "utf8");
    for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith(".expected.json"))) {
      const planted = JSON.parse(readFileSync(path.join(fixturesDir, file), "utf8")) as {
        issues: { principle_id: string }[];
      };
      for (const issue of planted.issues) {
        if (issue.principle_id.startsWith("rule:")) continue;
        expect(principles).toContain(`| ${issue.principle_id} |`);
      }
    }
  });
});
