import { badgeOffsets, regionPosition } from "./regions";

describe("regionPosition", () => {
  it("converts pixels to percentages of the image", () => {
    expect(regionPosition({ x: 256, y: 400, w: 1280, h: 160 }, 2560, 1600)).toEqual({
      left: "10%",
      top: "25%",
      width: "50%",
      height: "10%",
    });
  });

  it("clamps boxes to the image", () => {
    expect(regionPosition({ x: 900, y: -10, w: 400, h: 50 }, 1000, 1000)).toEqual({
      left: "90%",
      top: "0%",
      width: "10%",
      height: "5%",
    });
  });
});

describe("badgeOffsets", () => {
  it("shifts badges that share a corner so each stays visible", () => {
    const same = { x: 122, y: 1252, w: 598, h: 32 };
    expect(
      badgeOffsets(
        [{ x: 80, y: 152, w: 2400, h: 48 }, same, null, { ...same }, { ...same, x: 130 }],
        2560,
        1600,
      ),
    ).toEqual([0, 0, 0, 1, 2]);
  });
});
