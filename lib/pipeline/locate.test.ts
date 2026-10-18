import {
  LOCATE_SCHEMA,
  LOCATE_SYSTEM_PROMPT,
  LocateUnreadableError,
  parseControls,
} from "./locate";

const size = { width: 1280, height: 800 };
const control = (overrides: Record<string, unknown> = {}) => ({
  role: "button",
  label: "Pay €50.50",
  x: 350,
  y: 520,
  width: 90,
  height: 22,
  ...overrides,
});
const answer = (...controls: unknown[]) => JSON.stringify({ controls });

describe("call 1 prompt and schema", () => {
  it("asks for controls only, with boxes in pixels of the image", () => {
    expect(LOCATE_SYSTEM_PROMPT).toContain("You find interactive controls");
    expect(LOCATE_SYSTEM_PROMPT).toContain("Do not guess hidden elements.");
    const items = (LOCATE_SCHEMA as { properties: { controls: { items: { required: string[] } } } })
      .properties.controls.items;
    expect(items.required).toEqual(["role", "label", "x", "y", "width", "height"]);
  });
});

describe("parseControls", () => {
  it("reads a good answer as x, y, w, h boxes", () => {
    expect(parseControls(answer(control()), size)).toEqual({
      controls: [{ role: "button", label: "Pay €50.50", box: { x: 350, y: 520, w: 90, h: 22 } }],
      dropped: 0,
    });
  });

  it("drops invalid items instead of failing the call", () => {
    const result = parseControls(
      answer(
        control(),
        control({ x: -4 }),
        control({ width: 3 }),
        control({ height: 2.5 }),
        control({ x: 1250, width: 60 }),
        control({ y: 790, height: 20 }),
        control({ role: "image" }),
        control({ label: "  " }),
        { label: "No box" },
        control({ role: "link", label: "Terms", x: 97, y: 578, width: 32, height: 9 }),
      ),
      size,
    );
    expect(result.controls.map((c) => c.label)).toEqual(["Pay €50.50", "Terms"]);
    expect(result.dropped).toBe(8);
  });

  it("accepts an empty list", () => {
    expect(parseControls(answer(), size)).toEqual({ controls: [], dropped: 0 });
  });

  it("throws LocateUnreadableError for text that is not the expected JSON", () => {
    expect(() => parseControls("Here are the controls: Pay", size)).toThrow(LocateUnreadableError);
    expect(() => parseControls('{"buttons": []}', size)).toThrow(LocateUnreadableError);
    try {
      parseControls("nope", size);
    } catch (error) {
      expect((error as LocateUnreadableError).raw).toBe("nope");
    }
  });
});
