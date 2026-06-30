import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data } = await api.get("/affiliate-program/user/account-status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "PENDING" });
  }
}
