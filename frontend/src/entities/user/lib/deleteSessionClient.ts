// Клиентская версия для использования в браузере
export function deleteSessionClient() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }
} 