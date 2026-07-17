import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

export async function GET() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/kick/partners/stats`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
