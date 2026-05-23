import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const partnerTag = request.nextUrl.searchParams.get("tag");
  const response = NextResponse.next();
  
  if (partnerTag) {
    response.cookies.set("partnerTag", partnerTag);
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
      const backendUrl = process.env.NEXT_PUBLIC_HOST || 'http://localhost:3001';
      const userResponse = await fetch(`${backendUrl}/affiliate-program/user`, {
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
