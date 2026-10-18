import { removeScreenshots } from "@/lib/api/files";
import { handle, type RouteContext } from "@/lib/api/server";
import { deleteProject, getProject } from "@/lib/db/repo";
import { abortReview } from "@/lib/pipeline/run";

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle((db) => getProject(db, id));
}

/** DELETE: the project, its versions, reviews and notes, and its screenshots in data/. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle(async (db) => {
    for (const version of getProject(db, id).versions) {
      if (version.reviewId) abortReview(version.reviewId);
    }
    await removeScreenshots(deleteProject(db, id));
  });
}
