"use server";
import { cookies } from "next/headers";
import { api } from "@/shared/api";
import { IStats } from "@/entities/user/interface/IStats";

export async function getStats(currency?: string) {
    const token = cookies().get("access_token");

    if (!token) {
        return null;
    }
    try {
        const params = currency ? `?currency=${currency}` : '';
        const stats = await api.get<IStats>(`/affiliate-program/user/stats${params}`, { 
            headers: { Authorization: `Bearer ${token.value}` } 
        });
        return stats.data
    } catch (error) {
        return null;
    }
}