import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_SHORT_DOMAIN = "imbalance.click";

function shortClickDomain() {
  return (
    process.env.NEXT_PUBLIC_KICK_SHORT_CLICK_DOMAIN?.trim() || DEFAULT_SHORT_DOMAIN
  )
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

/** Legacy imba.bet/k/{slug} → canonical imbalance.click/{slug} */
export function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/k\/([^/]+)\/?$/);
  if (!match?.[1]) return NextResponse.next();

  const slug = decodeURIComponent(match[1]);
  const target = new URL(`https://${shortClickDomain()}/${encodeURIComponent(slug)}`);
  return NextResponse.redirect(target, 302);
}

export const config = {
  matcher: ["/k/:slug*"],
};
