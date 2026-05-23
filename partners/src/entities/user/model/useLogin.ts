import { AffiliateProgramLoginRequest } from "affiliate-program-api";
import { useState } from "react";
import { login as apiLogin } from "../api";
import { ILoginRequest } from "@/entities/user/api/login";
import axios, { AxiosError, AxiosResponse } from "axios";

export const useLogin = () => {
    const [response, setResponse] = useState<{
        error: string | null;
        pending: boolean;
        errorCode: number | null
    }>({
        error: null,
        pending: false,
        errorCode: null
    });

    const login = async (loginData: ILoginRequest) => {
        setResponse((prev) => ({ ...prev, pending: true }));

        try {
            const res = await apiLogin(loginData);
            setResponse((prev) => ({ ...prev, pending: false }));
            return true;
        } catch (error) {
            setResponse((prev) => ({ ...prev, error: error as string, pending: false }));
            if(axios.isAxiosError(error)) {
                setResponse((prev) => ({ ...prev, error: (error.response as AxiosResponse)?.data?.message[0], errorCode: (error.response as AxiosResponse)?.status }));
            }
            return false;
        }
    };

    const clearError = () => setResponse((prev) => ({ ...prev, error: null }));

    return { login, ...response, clearError };
};
