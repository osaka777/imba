import { api } from "@/shared/api";
import { AffiliateProgramRegisterRequest } from "affiliate-program-api";
import { useState } from "react";
import { IRegisterRequest, register as registerApi } from "./../api/register";
import axios, { AxiosResponse } from "axios";

export const useRegister = () => {
    const [response, setResponse] = useState<{
        error: string | null;
        pending: boolean;
    }>({
        error: null,
        pending: false,
    });

    const register = async (registerData: IRegisterRequest) => {
        setResponse((prev) => ({ ...prev, pending: true }));
        try {
            const res = await registerApi(registerData);
            setResponse((prev) => ({ ...prev, pending: false }));
            return res;
        } catch (error) {
            if(axios.isAxiosError(error)) {

                setResponse((prev) => ({ ...prev, error: (error.response as AxiosResponse)?.data?.message[0], pending: false }));

            } else {
                setResponse((prev) => ({ ...prev, error: "Произошла ошибка", pending: false }));
            }
            return null;
        }
    };

    const clearError = () => setResponse((prev) => ({ ...prev, error: null }));

    return { register, ...response, clearError };
};
