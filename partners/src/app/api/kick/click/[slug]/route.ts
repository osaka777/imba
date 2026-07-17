import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

type Params = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const { slug } = await params;
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/kick/click/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ found: false, channelSlug: slug }, { status: 502 });
  }
}
