import { NextResponse, type NextRequest } from "next/server";
import { MEASURED_ONLY_COOKIE } from "@/lib/measured-only";
import { getMode, hasClaude } from "@/lib/mode";

/**
 * docs/10: in demo mode every API route returns 404.
 * docs/03: in live mode without an API key every page goes to /setup, unless the owner chose
 * "Continue with measured checks only".
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mode = getMode();
  if (isApi(pathname)) {
    return mode === "demo" ? new NextResponse("Not found", { status: 404 }) : NextResponse.next();
  }
  if (
    mode === "live" &&
    needsSetup(pathname, hasClaude(process.env), request.cookies.get(MEASURED_ONLY_COOKIE)?.value)
  ) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  return NextResponse.next();
}

export function isApi(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** Live pages redirect to Connect Claude while no key is set and measured only was not chosen. */
export function needsSetup(pathname: string, connected: boolean, measuredOnly?: string): boolean {
  if (connected || measuredOnly === "1") return false;
  return pathname !== "/setup" && !pathname.startsWith("/states");
}

export const config = {
  matcher: ["/api", "/api/:path*", "/((?!_next/|demo/|favicon|robots|opengraph|twitter).*)"],
};
