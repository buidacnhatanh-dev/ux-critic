import type { Rgb } from "../contrast.ts";

/** Raw pixels, row by row, 3 (RGB) or 4 (RGBA) bytes per pixel. Alpha is ignored. */
export type RawImage = {
  data: Uint8Array;
  width: number;
  height: number;
  channels: 3 | 4;
};

/** Box in image pixels. */
export type PixelBox = { x: number; y: number; w: number; h: number };

export function pixelAt(img: RawImage, x: number, y: number): Rgb {
  const i = (y * img.width + x) * img.channels;
  return { r: img.data[i]!, g: img.data[i + 1]!, b: img.data[i + 2]! };
}

/** Clamp a box to the image and to whole pixels. Returns null when nothing is left. */
export function clampBox(img: RawImage, box: PixelBox): PixelBox | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(img.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(img.height, Math.ceil(box.y + box.h));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function expandBox(box: PixelBox, by: number): PixelBox {
  return { x: box.x - by, y: box.y - by, w: box.w + 2 * by, h: box.h + 2 * by };
}

/** Synthetic image for tests and fixtures: a background with filled rectangles on top. */
export function solidImage(
  width: number,
  height: number,
  background: Rgb,
  rects: { box: PixelBox; colour: Rgb }[] = [],
): RawImage {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let colour = background;
      for (const rect of rects) {
        const { box } = rect;
        if (x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h)
          colour = rect.colour;
      }
      const i = (y * width + x) * 3;
      data[i] = colour.r;
      data[i + 1] = colour.g;
      data[i + 2] = colour.b;
    }
  }
  return { data, width, height, channels: 3 };
}
