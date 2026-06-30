import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

export async function middleware(request: NextRequest) {
  const partnerTag = request.nextUrl.searchParams.get("tag");
  const response = NextResponse.next();
  const isProd = process.env.NODE_ENV === "production";
  
  if (partnerTag && /^[0-9a-f-]{36}$/i.test(partnerTag)) {
    response.cookies.set("partnerTag", partnerTag, {
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
      sameSite: "lax",
      secure: isProd,
    });
  }

  // Проверяем токен для защищенных маршрутов
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/profile');
  const token = request.cookies.get('access_token');

  if (isProtectedRoute) {
    if (!token) {
      // Нет токена - редирект на главную
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Проверяем валидность токена
    try {
      const userResponse = await fetch(`${getApiBaseUrl()}/affiliate-program/user`, {
        headers: {
          'Authorization': `Bearer ${token.value}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        // Токен недействителен - удаляем и редиректим
        response.cookies.delete('access_token');
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch (error) {
      // Ошибка при проверке токена - удаляем и редиректим
      response.cookies.delete('access_token');
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}
