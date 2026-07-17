import { useState } from "react";
import axios from "axios";
import { IRegisterRequest, register as registerApi } from "./../api/register";

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
            if (axios.isAxiosError(error)) {
                const data = error.response?.data as {
                    message?: string | string[];
                    errors?: Array<{
                        property?: string;
                        constraints?: Record<string, string>;
                    }>;
                } | undefined;

                let errorMessage = "Произошла ошибка";

                if (Array.isArray(data?.message) && data.message[0]) {
                    errorMessage = data.message[0];
                } else if (data?.errors?.length) {
                    const first = data.errors[0];
                    const constraint = first.constraints
                        ? Object.values(first.constraints)[0]
                        : undefined;

                    if (first.property === "password" && constraint?.includes("8")) {
                        errorMessage = "Пароль должен быть не короче 8 символов";
                    } else if (constraint) {
                        errorMessage = constraint;
                    }
                } else if (typeof data?.message === "string" && data.message !== "Validation failed") {
                    errorMessage = data.message;
                }

                setResponse((prev) => ({ ...prev, error: errorMessage, pending: false }));
            } else {
                setResponse((prev) => ({ ...prev, error: "Произошла ошибка", pending: false }));
            }
            return null;
        }
    };

    const clearError = () => setResponse((prev) => ({ ...prev, error: null }));

    return { register, ...response, clearError };
};
