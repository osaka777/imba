"use server";
import { cookies } from "next/headers";
import { api } from "@/shared/api";
import { IStats } from "@/entities/user/interface/IStats";
import { IBalances } from "@/entities/user/interface/IBalances";

export async function getBalances() {
    const token = cookies().get("access_token");

    if (!token) {
        return null;
    }
    try {
        const stats =  await api.get<IBalances[]>("/affiliate-program/user/balances", { headers: { Authorization: `Bearer ${token.value}` } });
        return stats.data
    } catch (error) {
        return null;
    }
}