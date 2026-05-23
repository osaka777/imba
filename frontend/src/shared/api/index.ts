import createClient from "openapi-fetch";
import { createManagedInterval } from "../lib";
import { components } from './api';

const getApiUrl = () => {
  // Всегда используем NEXT_PUBLIC_HOST для API запросов
  return process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';
};

const API_URL = getApiUrl();

export const api = createClient<any>({
  baseUrl: API_URL,
});

// Export components type from generated schema
export type { components } from './api';

const pendingRequests = new Map<string, { timestamp: number, promise: Promise<any> }>();

const createRequestKey = (url: string, method: string, body?: any) => {
  const bodyKey = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyKey}`;
};

const cleanupOldRequests = () => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, value] of pendingRequests.entries()) {
    if (now - value.timestamp > 3000) {
      pendingRequests.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 10) {
    console.debug(`Cleaned ${cleanedCount} old requests from cache`);
  }
};
