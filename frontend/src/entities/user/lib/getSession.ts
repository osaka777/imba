"use server";

import { cookies } from "next/headers";
import "server-only";

export async function getSession(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken");
    if (!accessToken?.value) {
      return null;
    }
    return accessToken.value;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}
