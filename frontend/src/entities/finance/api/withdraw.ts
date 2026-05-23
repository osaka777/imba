import { getSessionClient } from "~/entities/user/lib";
import { api } from "~/shared/api";

export const withdraw = async (data: any) => {
  const token = getSessionClient();

  console.log('[Withdraw API] Request data:', data);

  // Всегда используем стандартный endpoint для сохранения заявок в базе данных
  const endpoint = "/api/withdraw";

  console.log('[Withdraw API] Using endpoint:', endpoint);

  try {
    const { data: response, error } = await api.POST(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    });
    
    console.log('[Withdraw API] Response:', { response, error });
    
    if (error) {
      console.error('[Withdraw API] Error details:', error);
      throw new Error(error.message || JSON.stringify(error));
    }
    
    return { data: response };
  } catch (err) {
    console.error('[Withdraw API] Catch block error:', err);
    throw new Error(err instanceof Error ? err.message : 'Неизвестная ошибка при выводе средств');
  }
};
