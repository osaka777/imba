import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Use /affiliate-program/sign-in on the backend API" },
    { status: 410 },
  );
}
