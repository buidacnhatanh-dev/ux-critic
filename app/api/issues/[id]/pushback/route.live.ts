import { z } from "zod";
import { body, handle, type RouteContext } from "@/lib/api/server";
import { setPushback } from "@/lib/db/repo";

const schema = z.object({ reason: z.string() });

/** PUT: save the reason I disagree with a note. */
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle(async (db) => setPushback(db, id, (await body(request, schema)).reason));
}

/** DELETE: Undo, the note is open again. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle((db) => setPushback(db, id, null));
}
