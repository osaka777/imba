import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_MAX_AGE_SEC = 30 * 24 * 60 * 60;

function applyAccessTokenCookie(response: NextResponse, accessToken: string) {
  response.cookies.set("accessToken", accessToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACCESS_TOKEN_MAX_AGE_SEC,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      accessToken?: unknown;
    } | null;
    const accessToken =
      typeof body?.accessToken === "string" ? body.accessToken.trim() : "";

    if (!accessToken || accessToken.length < 16) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    applyAccessTokenCookie(response, accessToken);
    return response;
  } catch (error) {
    console.error("POST /auth/session failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("accessToken", "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
