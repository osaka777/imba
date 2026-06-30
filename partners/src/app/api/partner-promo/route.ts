import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = (await cookies()).get("access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data } = await axios.post(
      `${getApiBaseUrl()}/affiliate-program/user/promo-codes`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const msg = error.response?.data?.message;
      const text = Array.isArray(msg) ? msg[0] : msg || error.message;
      return NextResponse.json({ error: text }, { status: error.response?.status || 400 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
