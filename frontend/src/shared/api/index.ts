import createClient from "openapi-fetch";
import { createManagedInterval } from "../lib";
import { getClientLocale } from "../i18n/get-client-locale";
import { components } from './api';

const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

const API_URL = getApiUrl();

export const api = createClient<any>({
  baseUrl: API_URL,
});

api.use({
  // openapi-fetch ^0.9 passes Request as the 1st arg;
  // 0.12+ passes { request }. Support both so currency/user fetches don't crash.
  onRequest(input: Request | { request: Request }) {
    const request =
      input instanceof Request
        ? input
        : input?.request instanceof Request
          ? input.request
          : null;

    if (!request) {
      return input instanceof Request ? input : input?.request;
    }

    const locale = getClientLocale();
    request.headers.set("Accept-Language", locale);
    request.headers.set("X-Locale", locale);
    return request;
  },
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
