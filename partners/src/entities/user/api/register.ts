import { api } from "@/shared/api";
import { createSession } from "@/entities/user/lib";
import { IUser } from "@/entities/user/interface/IUser";
import { getPartnerTag } from "@/entities/user/lib/getPartnerTag";

export interface IRegisterRequest {
    email: string;
    password: string;
    trafficSource: string;
    type: 'REVSHARE' | 'CPA';
    meta?: {[key: string]: any};
    tag?: string;
}

export interface IRegisterResponse {
    accessToken: string;
    user: IUser,
}

export const register = async (registerData: IRegisterRequest) => {
    try {
        const {data} = await api.post<IRegisterResponse>("/affiliate-program/sign-up", {
            ...registerData, tag: await getPartnerTag()
        });
        if (data?.accessToken) {
            await createSession(data.accessToken);
            return true;
        }
        return false;
    } catch (error) {
        throw error;
    }
};