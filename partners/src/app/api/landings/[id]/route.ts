import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";
import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const t = (await cookies()).get("access_token")?.value;
  if (!t) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await axios.delete(`${getApiBaseUrl()}/affiliate-program/user/landings/${id}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (axios.isAxiosError(e)) {
      return NextResponse.json(e.response?.data ?? { error: "Failed" }, {
        status: e.response?.status ?? 500,
      });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
