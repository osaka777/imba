"use server";

import { cookies } from "next/headers";
import "server-only";
import { getUser } from "../api";
import { IUser } from "../interface/IUser";

export async function verifySession(): Promise<IUser | null> {
    const cookieStore = await cookies();
    const access_token = cookieStore.get("access_token");

    if (!access_token) {
        return null;
    }

    try {
        const user = await getUser(access_token.value);
        return user; // getUser already returns null if invalid
    } catch (error) {
        return null;
    }
}

// Отдельная Server Action для очистки токена
export async function clearInvalidToken() {
    const cookieStore = await cookies();
    cookieStore.delete("access_token");
}
