"use server";

import { cookies } from "next/headers";

export async function deleteSession() {
  cookies().delete("accessToken");
}
