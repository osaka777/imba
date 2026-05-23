import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const rates = await request.json();

  const response = new NextResponse();

  response.cookies.set("rates", JSON.stringify(rates));

  return response;
}

export async function GET() {
  const response = new NextResponse();

  const value = cookies().get("rates")?.value;

  if (!value) {
    return response;
  }

  return new NextResponse(value, {
    headers: new Headers({ "content-type": "application/json" }),
  });
}
