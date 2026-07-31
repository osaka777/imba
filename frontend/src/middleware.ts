import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildAiAccessDeniedHtml } from "~/shared/lib/aiAccessDeniedHtml";
import { isAiBotUserAgent } from "~/shared/lib/aiBotDetection";

const DEFAULT_SHORT_DOMAIN = "imbalance.click";

function shortClickDomain() {
  return (
    process.env.NEXT_PUBLIC_KICK_SHORT_CLICK_DOMAIN?.trim() || DEFAULT_SHORT_DOMAIN
  )
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function aiAccessDeniedResponse(): NextResponse {
  return new NextResponse(buildAiAccessDeniedHtml(), {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noai, noimageai, noindex",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * 1) Refuse AI agents/crawlers (Cursor, Claude, GPTBot, ClaudeBot, ...)
 *    before any page renders — see `~/shared/lib/aiBotDetection`.
 * 2) Legacy imba.bet/k/{slug} → canonical imbalance.click/{slug}.
 */
export function middleware(request: NextRequest) {
  if (isAiBotUserAgent(request.headers.get("user-agent"))) {
    return aiAccessDeniedResponse();
  }

  const match = request.nextUrl.pathname.match(/^\/k\/([^/]+)\/?$/);
  if (!match?.[1]) return NextResponse.next();

  const slug = decodeURIComponent(match[1]);
  const target = new URL(`https://${shortClickDomain()}/${encodeURIComponent(slug)}`);
  return NextResponse.redirect(target, 302);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|llms\\.txt|ai\\.txt|sitemap\\.xml|manifest\\.webmanifest|icons/|images/).*)",
  ],
};
