import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

export async function GET(request: NextRequest) {
  const target = new URL(`${getApiBaseUrl()}/kick/oauth/callback`);
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  try {
    const upstream = await fetch(target.toString(), { redirect: "manual" });
    const location = upstream.headers.get("location");
    if (location) {
      return NextResponse.redirect(location);
    }
  } catch {
    /* fall through */
  }

  return NextResponse.redirect(new URL("/profile/stream?kick=error", request.url));
}
