'use client';

import React from 'react';
import { useAuth } from '../../hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback = <div>Проверка авторизации...</div> 
}) => {
  const { user, loading, error } = useAuth();

  if (loading) {
    return <>{fallback}</>;
  }

  if (error) {
    return <div>Ошибка: {error}</div>;
  }

  if (!user) {
    // Пользователь не авторизован, middleware должен был перенаправить
    return <div>Перенаправление...</div>;
  }

  return <>{children}</>;
};
