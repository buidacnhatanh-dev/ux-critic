import { z } from "zod";
import { body, handle, type RouteContext } from "@/lib/api/server";
import { saveChecklist } from "@/lib/db/repo";

const change = z.union([
  z.object({
    rule: z.object({
      text: z.string(),
      kind: z.enum(["measured", "evaluated"]),
      metric: z.enum(["target_size_min", "text_size_min", "contrast_min"]).nullable(),
      threshold: z.number().positive().nullable(),
      position: z.number().int(),
      enabled: z.boolean(),
    }),
  }),
  z.object({ move: z.enum(["up", "down"]) }),
]);

/** PUT: edit a rule, or move it up or down. */
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle(async (db) => {
    const input = await body(request, change);
    saveChecklist(
      db,
      "move" in input
        ? { type: "moveRule", ruleId: id, direction: input.move }
        : { type: "updateRule", rule: { ...input.rule, id } },
    );
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handle((db) => saveChecklist(db, { type: "deleteRule", ruleId: id }));
}
