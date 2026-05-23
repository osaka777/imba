import { getSessionClient } from "../lib/getSessionClient";
import { api } from "~/shared/api";

export const changePassword = async (data: {
  newPassword: string;
  oldPassword?: string;
}) => {
  const token = getSessionClient();

  const { data: response, error } = await api.PATCH("/api/user/update-password", {
    headers: { Authorization: `Bearer ${token}` },
    body: data,
  });
  if (error) throw error;
  return response;
};
