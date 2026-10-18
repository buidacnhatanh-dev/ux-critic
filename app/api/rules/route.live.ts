import { z } from "zod";
import { body, handle } from "@/lib/api/server";
import { getChecklist, saveChecklist } from "@/lib/db/repo";

const ruleFields = {
  text: z.string(),
  kind: z.enum(["measured", "evaluated"]),
  metric: z.enum(["target_size_min", "text_size_min", "contrast_min"]).nullable(),
  threshold: z.number().positive().nullable(),
  enabled: z.boolean(),
};
const create = z.union([
  z.object({ type: z.literal("createRule"), rule: z.object(ruleFields) }),
  z.object({
    type: z.literal("restoreRule"),
    rule: z.object({ ...ruleFields, id: z.string().min(1), position: z.number().int() }),
  }),
]);

/** GET: My checklist, the principle sets and own rules. */
export function GET() {
  return handle((db) => getChecklist(db));
}

/** POST: add a rule, or put a deleted one back (Undo). */
export function POST(request: Request) {
  return handle(async (db) => saveChecklist(db, await body(request, create)));
}
