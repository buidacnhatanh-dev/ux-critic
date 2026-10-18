/**
 * Shared by the live API routes (app/api/**\/route.live.ts). Those files are only part of the app
 * when UXC_MODE=live (next.config.ts), and proxy.ts answers 404 for /api in demo mode as well.
 */
import { NextResponse } from "next/server";
import { NotFoundError, ValidationError } from "../data/client.ts";
import { getMode } from "../mode.ts";
import { getDb, type Db } from "../db/client.ts";

export type RouteContext<P extends string = "id"> = { params: Promise<Record<P, string>> };

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data ?? null, { status });
}

/** Runs a route with the database; maps known errors to 400 and 404. */
export async function handle(run: (db: Db) => Promise<unknown> | unknown): Promise<NextResponse> {
  if (getMode() !== "live") return new NextResponse("Not found", { status: 404 });
  try {
    const result = await run(getDb());
    return result instanceof NextResponse || result instanceof Response
      ? (result as NextResponse)
      : json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof NotFoundError) return json({ message: error.message }, 404);
    if (error instanceof ValidationError) {
      return json({ field: error.field, message: error.message }, 400);
    }
    console.error(error);
    return json({ message: error instanceof Error ? error.message : String(error) }, 500);
  }
}

/** Parses a JSON body with zod; a bad body is a 400. */
export async function body<T>(
  request: Request,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ValidationError("body", "The request body is not JSON.");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ValidationError("body", "The request body is not valid.");
  return parsed.data;
}
