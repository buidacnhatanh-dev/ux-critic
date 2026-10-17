import { numberInReadingOrder } from "./order";

const at = (id: string, x: number, y: number) => ({ id, region: { x, y, w: 10, h: 10 } });

describe("numberInReadingOrder", () => {
  it("numbers top to bottom", () => {
    const result = numberInReadingOrder([at("b", 0, 200), at("a", 0, 10)]);
    expect(result.map((r) => [r.id, r.number])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("numbers left to right within a row", () => {
    const result = numberInReadingOrder([at("right", 500, 104), at("left", 20, 100)]);
    expect(result.map((r) => r.id)).toEqual(["left", "right"]);
  });

  it("puts whole screen issues (no region) last", () => {
    const result = numberInReadingOrder([{ id: "screen", region: null }, at("a", 0, 900)]);
    expect(result.map((r) => r.id)).toEqual(["a", "screen"]);
  });

  it("does not change the input", () => {
    const input = [at("b", 0, 200), at("a", 0, 10)];
    numberInReadingOrder(input);
    expect(input.map((i) => i.id)).toEqual(["b", "a"]);
  });
});
