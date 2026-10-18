import { handle, type RouteContext } from "@/lib/api/server";
import { ValidationError } from "@/lib/data/client";
import { getReview } from "@/lib/db/repo";
import { retryEvaluation } from "@/lib/pipeline/run";

/** POST: Retry evaluation on a partial review (evaluate and place only, docs/03). */
export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle((db) => {
    const review = getReview(db, id);
    if (review.status !== "partial") {
      throw new ValidationError("review", "Only a review with a missing evaluation can retry it.");
    }
    void retryEvaluation(db, id);
  });
}
