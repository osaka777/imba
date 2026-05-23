'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '../api/getUser';
import { IUser } from '../interface/IUser';

interface AuthState {
  user: IUser | null;
  loading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  const router = useRouter();

  const checkAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      // Проверяем наличие токена в cookies
      const tokenExists = document.cookie.includes('access_token=');
      
      if (!tokenExists) {
        setAuthState({ user: null, loading: false, error: null });
        return false;
      }

      // Получаем токен из cookies
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1];

      if (!token) {
        setAuthState({ user: null, loading: false, error: null });
        return false;
      }

      const user = await getUser(token);
      
      if (user) {
        setAuthState({ user, loading: false, error: null });
        return true;
      } else {
        // Токен недействителен, очищаем cookies
        document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        setAuthState({ user: null, loading: false, error: null });
        return false;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // При ошибке очищаем cookies
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      setAuthState({ user: null, loading: false, error: 'Ошибка проверки авторизации' });
      return false;
    }
  };

  const logout = () => {
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setAuthState({ user: null, loading: false, error: null });
    router.push('/');
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    ...authState,
    checkAuth,
    logout,
    isAuthenticated: !!authState.user && !authState.loading,
  };
};
