import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/wc" || pathname === "/wc/") {
    return NextResponse.redirect(new URL("/line/soccer", request.url), 308);
  }

  if (pathname.startsWith("/wc/game/")) {
    const slug = pathname.slice("/wc/game/".length);
    if (slug) {
      return NextResponse.redirect(new URL(`/game/${slug}`, request.url), 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/wc", "/wc/", "/wc/game/:path*"],
};
