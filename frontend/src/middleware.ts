import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const partnerTag = request.nextUrl.searchParams.get("tag");
  const response = NextResponse.next();
  if (partnerTag) {
    response.cookies.set("partnerTag", partnerTag);
  }
  return response;
}
