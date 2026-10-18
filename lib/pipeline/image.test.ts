// @vitest-environment node
import sharp from "sharp";
import { imageForClaude, MAX_SENT_EDGE, sentSize, toOriginal, toStoredPng } from "./image";

describe("sentSize", () => {
  it("keeps images up to 2576 px on the long edge", () => {
    expect(sentSize(1280, 800)).toEqual({ width: 1280, height: 800, factor: 1 });
    expect(sentSize(2576, 1000)).toEqual({ width: 2576, height: 1000, factor: 1 });
  });

  it("shrinks larger images and keeps f = original / sent", () => {
    const size = sentSize(5152, 3220);
    expect(size.width).toBe(MAX_SENT_EDGE);
    expect(size.height).toBe(1610);
    expect(size.factor).toBe(2);
  });

  it("works for tall images", () => {
    const size = sentSize(1170, 7800);
    expect(size.height).toBe(MAX_SENT_EDGE);
    expect(size.factor).toBeCloseTo(7800 / MAX_SENT_EDGE);
  });
});

describe("coordinate mapping", () => {
  it("round trips a box between sent and original pixels", () => {
    const { factor } = sentSize(5152, 3220);
    const sent = { x: 100, y: 40, w: 300, h: 50 };
    const original = toOriginal(sent, factor);
    expect(original).toEqual({ x: 200, y: 80, w: 600, h: 100 });
    expect(toOriginal(original, 1 / factor)).toEqual(sent);
  });
});

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#336699" } });

describe("toStoredPng and imageForClaude", () => {
  it("stores JPEG and WebP uploads as PNG with their size", async () => {
    const jpeg = await solid(40, 30).jpeg().toBuffer();
    const stored = await toStoredPng(jpeg);
    expect(stored.format).toBe("jpeg");
    expect([stored.width, stored.height]).toEqual([40, 30]);
    expect((await sharp(stored.png).metadata()).format).toBe("png");
    const webp = await solid(20, 10).webp().toBuffer();
    expect((await toStoredPng(webp)).format).toBe("webp");
  });

  it("refuses files that are not PNG, JPEG or WebP", async () => {
    await expect(toStoredPng(Buffer.from("%PDF-1.4"))).rejects.toThrow();
    const gif = await solid(4, 4).gif().toBuffer();
    await expect(toStoredPng(gif)).rejects.toThrow(/Unsupported/);
  });

  it("resizes large screenshots for Claude and reports the factor", async () => {
    const png = await solid(3000, 1000).png().toBuffer();
    const image = await imageForClaude(png);
    expect(image.mediaType).toBe("image/png");
    expect([image.width, image.height]).toEqual([2576, 859]);
    const meta = await sharp(Buffer.from(image.base64, "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([2576, 859]);
    expect(image.factor).toBeCloseTo(3000 / 2576);
  });
});
