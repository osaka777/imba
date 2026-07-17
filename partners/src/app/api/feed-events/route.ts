import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") || "line";
  const sport = request.nextUrl.searchParams.get("sport") || "soccer";
  const q = request.nextUrl.searchParams.get("q")?.trim();

  try {
    if (q) {
      const { data } = await axios.get(`${getApiBaseUrl()}/feed/search`, {
        params: { q, sport, limit: 20 },
      });
      return NextResponse.json(data);
    }

    const path = mode === "live" ? "feed/live/events" : "feed/line/events";
    const { data } = await axios.get(`${getApiBaseUrl()}/${path}`, {
      params: { sport, limit: 24, hours: mode === "line" ? 72 : undefined },
    });
    const list = Array.isArray(data) ? data : data?.events ?? [];
    return NextResponse.json(list);
  } catch (e) {
    if (axios.isAxiosError(e)) {
      return NextResponse.json(e.response?.data ?? { error: "Failed" }, {
        status: e.response?.status ?? 500,
      });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
