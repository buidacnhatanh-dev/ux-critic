import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { handle, type RouteContext } from "@/lib/api/server";
import { NotFoundError } from "@/lib/data/client";
import { versions } from "@/lib/db/schema";

/** GET: the stored PNG of a version. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle(async (db) => {
    const version = db.select().from(versions).where(eq(versions.id, id)).get();
    if (!version) throw new NotFoundError("Screenshot", id);
    const png = await readFile(version.screenshotPath).catch(() => {
      throw new NotFoundError("Screenshot", id);
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  });
}
