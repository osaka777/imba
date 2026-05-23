import { api } from "@/shared/api";
import { AffiliateProgramLoginRequest } from "affiliate-program-api";
import { createSession } from "../lib/createSession";
import { IUser } from "@/entities/user/interface/IUser";

export interface ILoginRequest {
    email: string;
    password: string;
}

export interface ILoginResponse {
    accessToken: string;
    user: IUser,
}

export const login = async (loginData: ILoginRequest) => {
    try {
        const {data} = await api.post<ILoginResponse>("/affiliate-program/sign-in", loginData);
        if (data?.accessToken) {
            await createSession(data.accessToken);

            return data;
        }
        return data;
    } catch (error) {
        throw error;
    }
};
