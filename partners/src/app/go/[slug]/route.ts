import { NextRequest, NextResponse } from "next/server";

type Params = {
  params: Promise<{ slug: string }>;
};

function shortClickDomain() {
  return (
    process.env.NEXT_PUBLIC_KICK_SHORT_CLICK_DOMAIN?.trim() || "imbalance.click"
  )
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const target = `https://${shortClickDomain()}/${encodeURIComponent(slug)}`;
  return NextResponse.redirect(target, 302);
}
