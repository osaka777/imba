import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

function isKickHost(request: NextRequest): boolean {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  return host === "kick.imba.bet";
}

export async function middleware(request: NextRequest) {
  const partnerTag = request.nextUrl.searchParams.get("tag");
  const response = NextResponse.next();
  const isProd = process.env.NODE_ENV === "production";
  const kickHost = isKickHost(request);
  const pathname = request.nextUrl.pathname;

  if (partnerTag && /^[0-9a-f-]{36}$/i.test(partnerTag)) {
    response.cookies.set("partnerTag", partnerTag, {
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
      sameSite: "lax",
      secure: isProd,
    });
  }

  if (kickHost && (pathname === "/" || pathname === "")) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/kick";
    return NextResponse.rewrite(rewriteUrl);
  }

  // Проверяем токен для защищенных маршрутов
  const isProtectedRoute = pathname.startsWith("/profile");
  const token = request.cookies.get("access_token");

  if (isProtectedRoute) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Проверяем валидность токена
    try {
      const userResponse = await fetch(`${getApiBaseUrl()}/affiliate-program/user`, {
        headers: {
          Authorization: `Bearer ${token.value}`,
          "Content-Type": "application/json",
        },
      });

      if (!userResponse.ok) {
        response.cookies.delete("access_token");
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      response.cookies.delete("access_token");
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}
