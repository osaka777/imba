import { api } from "@/shared/api";
import { IUser } from "@/entities/user/interface/IUser";

export const getUser = async (token: string) => {
    try {
        const user = await api.get<IUser>("/affiliate-program/user", { headers: { Authorization: `Bearer ${token}` } });

        return user.data;
    } catch (error) {
        return null;
    }
};
