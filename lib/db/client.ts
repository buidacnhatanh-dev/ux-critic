/**
 * Live mode only (docs/10): opens data/uxcritic.db, applies migrations, seeds the checklist on the
 * first run and marks reviews that a restart interrupted as failed (docs/01). Never imported by
 * screens or by anything in demo mode.
 */
import Database from "better-sqlite3";
import { eq, inArray } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import * as schema from "./schema.ts";
import { DEFAULT_SOURCES, SEED_RULES } from "./seed.ts";

export type Db = BetterSQLite3Database<typeof schema>;

/** `data/` by default. Tests point UXC_DATA_DIR at a folder of their own. */
export function dataDir(): string {
  // Live mode runs locally and is never deployed, so the build does not trace these paths.
  return resolve(/*turbopackIgnore: true*/ process.env.UXC_DATA_DIR?.trim() || "data");
}

export function screenshotsDir(): string {
  return join(dataDir(), "screenshots");
}

const MIGRATIONS = resolve(/*turbopackIgnore: true*/ "lib/db/migrations");

/** The message stored on reviews that were running when the server stopped. */
export const INTERRUPTED_MESSAGE =
  "The app stopped while this review was running. Measured results are kept.";

/** Opens (or creates) a database and brings it up to date. Used by the app and by tests. */
export function openDb(file: string): { db: Db; sqlite: Database.Database } {
  if (file !== ":memory:")
    mkdirSync(resolve(/*turbopackIgnore: true*/ file, ".."), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  seed(db);
  return { db, sqlite };
}

/** First run: the six rules from the design and every principle set on (docs/02). */
export function seed(db: Db, newId: () => string = () => crypto.randomUUID()) {
  db.transaction((tx) => {
    const done = tx.select().from(schema.settings).where(eq(schema.settings.key, "sources")).get();
    if (done) return;
    tx.insert(schema.settings)
      .values({ key: "sources", value: JSON.stringify(DEFAULT_SOURCES) })
      .run();
    tx.insert(schema.rules)
      .values(
        SEED_RULES.map((rule, i) => ({
          ...rule,
          id: newId(),
          position: i + 1,
          enabled: 1,
        })),
      )
      .run();
  });
}

/**
 * A review left queued or running belongs to a server that stopped: nothing will finish it.
 * Mark it failed and keep what was measured (docs/01).
 */
export function failInterruptedReviews(db: Db, now = new Date()): number {
  const stuck = db
    .select({ id: schema.reviews.id })
    .from(schema.reviews)
    .where(inArray(schema.reviews.status, ["queued", "running"]))
    .all();
  if (stuck.length === 0) return 0;
  db.update(schema.reviews)
    .set({
      status: "failed",
      error: JSON.stringify({
        message: INTERRUPTED_MESSAGE,
        detail: "The server process restarted before the review finished.",
      }),
      finishedAt: now.toISOString(),
    })
    .where(
      inArray(
        schema.reviews.id,
        stuck.map((r) => r.id),
      ),
    )
    .run();
  return stuck.length;
}

// One connection per server process. Kept on globalThis so hot reloads in `pnpm dev` reuse it
// instead of opening a second one (and instead of failing reviews that are still running).
const globalDb = globalThis as typeof globalThis & { __uxcDb?: Db };

export function getDb(): Db {
  if (!globalDb.__uxcDb) {
    const { db } = openDb(join(dataDir(), "uxcritic.db"));
    failInterruptedReviews(db);
    globalDb.__uxcDb = db;
  }
  return globalDb.__uxcDb;
}
