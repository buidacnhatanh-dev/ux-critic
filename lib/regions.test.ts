import { badgePlacements, regionPosition } from "./regions";

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

describe("badgePlacements", () => {
  it("shifts badges that share a corner so each stays visible", () => {
    const same = { x: 122, y: 1252, w: 598, h: 32 };
    expect(
      badgePlacements(
        [{ x: 80, y: 152, w: 2400, h: 48 }, same, null, { ...same }, { ...same, x: 130 }],
        2560,
      ).map((p) => p.offset),
    ).toEqual([0, 0, 0, 1, 2]);
  });

  it("puts badges of close corners on the group's corner (a note just above a measured line)", () => {
    // Live review of checkout v1: evaluated note at 256, 480; measured faint text at 194, 505.
    expect(
      badgePlacements(
        [
          { x: 256, y: 480, w: 1024, h: 192 },
          { x: 194, y: 505, w: 520, h: 50 },
          { x: 256, y: 880, w: 1280, h: 160 },
        ],
        2560,
      ),
    ).toEqual([
      { offset: 0, anchor: null },
      { offset: 1, anchor: { left: "11.92%", top: "-50%" } },
      { offset: 0, anchor: null },
    ]);
  });
});
