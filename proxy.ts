import { NextResponse, type NextRequest } from "next/server";
import { getMode } from "@/lib/mode";

/** docs/10: in demo mode every API route returns 404. */
export function proxy(request: NextRequest) {
  if (isBlockedInDemo(request.nextUrl.pathname) && getMode() === "demo") {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export function isBlockedInDemo(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export const config = { matcher: ["/api", "/api/:path*"] };
