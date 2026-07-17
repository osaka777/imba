import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

async function token() {
  return (await cookies()).get("access_token")?.value;
}

export async function POST() {
  const t = await token();
  if (!t) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data } = await axios.post(
      `${getApiBaseUrl()}/affiliate-program/user/kick/resubscribe`,
      {},
      { headers: { Authorization: `Bearer ${t}` } },
    );
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
