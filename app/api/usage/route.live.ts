import { handle } from "@/lib/api/server";
import { tokenUsageSince } from "@/lib/db/repo";

/** GET: tokens used by reviews started this month, for the spend line on My checklist. */
export function GET() {
  return handle((db) => {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return tokenUsageSince(db, since);
  });
}
