import { api, components } from "~/shared/api";

import { createSessionClient } from "../lib/createSessionClient";
import { createSession } from "../lib/createSession";

export const login = async (body: components["schemas"]["AuthenticateDto"]) => {
  const { data, error } = await api.POST("/api/sign-in", { body });

  if (data) {
    console.log('login: Received accessToken:', data.accessToken);
    // Сохраняем токен в localStorage для клиентской стороны
    await createSessionClient(data.accessToken);
    console.log('login: Token saved to localStorage');
    
    // Сохраняем токен в cookies для серверной стороны
    await createSession(data.accessToken);
    console.log('login: Token saved to cookies');
    
    return;
  }
  throw error;
};
