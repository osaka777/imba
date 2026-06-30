import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PARTNER_TAG_MAX_AGE = 60 * 60 * 24 * 90;
const PROMO_CODE_MAX_AGE = 60 * 60 * 24 * 30;
const SUBS_MAX_AGE = 60 * 60 * 24 * 90;
const SUB_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;

function readSubsFromRequest(request: NextRequest): Record<string, string> {
  const subs: Record<string, string> = {};
  for (let i = 1; i <= 5; i++) {
    const key = `sub${i}`;
    const val = request.nextUrl.searchParams.get(key)?.trim().slice(0, 64);
    if (val && SUB_PATTERN.test(val)) subs[key] = val;
  }
  return subs;
}

function applyPartnerTagCookie(request: NextRequest, response: NextResponse) {
  const tag = request.nextUrl.searchParams.get("tag");
  if (!tag || !/^[0-9a-f-]{36}$/i.test(tag)) {
    return;
  }

  response.cookies.set("partnerTag", tag, {
    maxAge: PARTNER_TAG_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function applyPromoCodeCookie(request: NextRequest, response: NextResponse) {
  const promo = request.nextUrl.searchParams.get("promo");
  if (!promo || !/^[a-zA-Z0-9_-]{2,32}$/.test(promo)) {
    return;
  }

  response.cookies.set("promoCode", promo.toUpperCase(), {
    maxAge: PROMO_CODE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function applySubsCookie(request: NextRequest, response: NextResponse) {
  const incoming = readSubsFromRequest(request);
  if (Object.keys(incoming).length === 0) return;

  let merged = incoming;
  const existing = request.cookies.get("affiliateSubs")?.value;
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as Record<string, string>;
      merged = { ...parsed, ...incoming };
    } catch {
      merged = incoming;
    }
  }

  response.cookies.set("affiliateSubs", JSON.stringify(merged), {
    maxAge: SUBS_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function applyAttributionCookies(request: NextRequest, response: NextResponse) {
  applyPartnerTagCookie(request, response);
  applyPromoCodeCookie(request, response);
  applySubsCookie(request, response);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/wc" || pathname === "/wc/") {
    const response = NextResponse.redirect(new URL("/line/soccer", request.url), 308);
    applyAttributionCookies(request, response);
    return response;
  }

  if (pathname.startsWith("/wc/game/")) {
    const slug = pathname.slice("/wc/game/".length);
    if (slug) {
      const response = NextResponse.redirect(new URL(`/game/${slug}`, request.url), 308);
      applyAttributionCookies(request, response);
      return response;
    }
  }

  const response = NextResponse.next();
  applyAttributionCookies(request, response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
