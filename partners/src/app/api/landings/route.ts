import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";
import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

async function token() {
  return (await cookies()).get("access_token")?.value;
}

export async function GET() {
  const t = await token();
  if (!t) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { data } = await axios.get(`${getApiBaseUrl()}/affiliate-program/user/landings`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (axios.isAxiosError(e)) {
      return NextResponse.json(e.response?.data ?? { error: "Failed" }, {
        status: e.response?.status ?? 500,
      });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const t = await token();
  if (!t) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const { data } = await axios.post(
      `${getApiBaseUrl()}/affiliate-program/user/landings`,
      body,
      { headers: { Authorization: `Bearer ${t}` } },
    );
    return NextResponse.json(data);
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const msg = e.response?.data?.message;
      const text = Array.isArray(msg) ? msg[0] : msg || e.message;
      return NextResponse.json({ error: text }, { status: e.response?.status ?? 400 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
