'use server';

import { cookies } from "next/headers";
import { api } from "@/shared/api";

export async function updateUserInfo(data: unknown) {
    const token = cookies().get("access_token");

    if (!token) {
        return null;
    }
    try {
        const stats = await api.patch("/affiliate-program/user/profile", data, {
            headers: { Authorization: `Bearer ${token.value}` },
        });

        return stats.data;
    } catch {
        return null;
    }
}
