import { handle } from "@/lib/api/server";
import { listProjects } from "@/lib/db/repo";

export function GET() {
  return handle((db) => listProjects(db));
}
