import { defineConfig } from "drizzle-kit";

/** `pnpm db:generate` writes SQL migrations from lib/db/schema.ts (docs/02). */
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
});
