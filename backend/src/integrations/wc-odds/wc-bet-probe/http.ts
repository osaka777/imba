import type { WcBetProbeConfig } from './config';

export class WcBetProbeHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'WcBetProbeHttpError';
  }
}

export async function probeFetchJson<T>(
  config: WcBetProbeConfig,
  path: string,
  init?: RequestInit & { token?: string; probeSecret?: string },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) {
    headers.Authorization = `Bearer ${init.token}`;
  }
  const probeSecret = init?.probeSecret ?? config.probeSecret;
  if (probeSecret) {
    headers['X-WC-Probe-Secret'] = probeSecret;
  }
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      throw new WcBetProbeHttpError(
        `HTTP ${res.status} for ${path}`,
        res.status,
        path,
        parsed,
      );
    }
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function probeFetchStatus(config: WcBetProbeConfig): Promise<{ enabled: boolean }> {
  return probeFetchJson(config, '/api/feed/status');
}
