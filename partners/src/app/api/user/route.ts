import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/entities/user";

export async function GET(request: NextRequest) {
    try {
        const user = await verifySession();
        
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}