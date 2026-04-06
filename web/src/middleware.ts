import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasSession = Boolean(request.cookies.get("buddy_token")?.value);

  if (path.startsWith("/feed") && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if ((path === "/login" || path === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/feed", "/feed/:path*", "/login", "/register"],
};
