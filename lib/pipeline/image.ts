import sharp from "sharp";
import type { RawImage } from "./raw-image.ts";

/** Load any image file or buffer as raw RGB pixels (alpha flattened onto white). */
export async function loadRaw(input: string | Buffer): Promise<RawImage> {
  const { data, info } = await sharp(input)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height, channels: 3 };
}
