"use server";

import { cookies } from "next/headers";
import "server-only";

export async function deleteSession() {
    cookies().delete("access_token");
}
