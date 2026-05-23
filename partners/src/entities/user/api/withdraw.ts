'use server'
import { cookies } from "next/headers";
import { api } from "@/shared/api";
import { IStats } from "@/entities/user/interface/IStats";
import axios, { AxiosResponse } from "axios";

export async function withdraw(data: any) {
    const token = cookies().get("access_token");

    if (!token) {
        return null;
    }
    try {
        const stats =  await api.post<any>("/affiliate-program/user/withdraw", data, { headers: { Authorization: `Bearer ${token.value}` } });

        return stats.data
    } catch (error) {
        if(axios.isAxiosError(error)) {
            return {
                error: true,
                message: (error.response as AxiosResponse)?.data?.message[0]
            };
        } else {
            return {
                error: true,
                message: "произошла ошибка"
            }
        }
    }
}