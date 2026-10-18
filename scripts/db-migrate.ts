/**
 * `pnpm db:migrate`: creates or updates data/uxcritic.db (docs/02) and seeds the checklist on the
 * first run. The app does the same when it opens the database, so this is optional.
 */
import { join } from "node:path";
import { dataDir, openDb } from "../lib/db/client.ts";

const file = join(dataDir(), "uxcritic.db");
const { sqlite } = openDb(file);
const tables = sqlite
  .prepare(
    "select name from sqlite_master where type = 'table' and name not like '\\_\\_%' escape '\\' and name != 'sqlite_sequence' order by name",
  )
  .all() as { name: string }[];
sqlite.close();
console.log(`db:migrate: ${file} is up to date (${tables.map((t) => t.name).join(", ")}).`);
