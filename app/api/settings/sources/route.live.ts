import { body, handle } from "@/lib/api/server";
import { sourceSettingsSchema } from "@/lib/db/json";
import { saveChecklist } from "@/lib/db/repo";

/** PUT: which principle sets are on. */
export function PUT(request: Request) {
  return handle(async (db) =>
    saveChecklist(db, { type: "sources", sources: await body(request, sourceSettingsSchema) }),
  );
}
