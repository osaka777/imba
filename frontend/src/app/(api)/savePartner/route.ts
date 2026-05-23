import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const partnerTag = await request.text();

  const response = new NextResponse();

  response.cookies.set("partnerTag", partnerTag);

  return response;
}
