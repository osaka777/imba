"use server";
import { cookies } from "next/headers";
import { api } from "@/shared/api";
import { IStats } from "@/entities/user/interface/IStats";

export async function getOperations() {
    const token = cookies().get("access_token");

    if (!token) {
        return null;
    }
    try {
        const stats =  await api.get<any>("/affiliate-program/user/operations", { headers: { Authorization: `Bearer ${token.value}` } });
        return stats.data
    } catch (error) {
        return null;
    }
}