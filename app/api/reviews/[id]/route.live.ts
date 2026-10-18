import { removeScreenshots } from "@/lib/api/files";
import { handle, type RouteContext } from "@/lib/api/server";
import { cancelReview, getReview } from "@/lib/db/repo";
import { abortReview } from "@/lib/pipeline/run";

/** GET: status, step and results so far (polled every second). */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle((db) => getReview(db, id));
}

/** DELETE: Cancel review. Aborts the running call and removes the version it created. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle(async (db) => {
    abortReview(id);
    await removeScreenshots(cancelReview(db, id));
  });
}
