import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

type Params = { params: Promise<{ tag: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { tag } = await params;

  try {
    const res = await fetch(
      `${getApiBaseUrl()}/kick/partners/widget/${encodeURIComponent(tag)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ found: false }, { status: 500 });
  }
}
