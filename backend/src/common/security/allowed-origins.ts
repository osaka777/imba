/** Browser / SPA origins allowed to call mutating API methods. */
export const ALLOWED_WEB_ORIGINS = [
  'http://localhost:9000',
  'http://localhost:8001',
  'http://localhost:8000',
  'http://127.0.0.1:8088',
  'http://localhost:3000',
  'https://imba.bet',
  'https://partners.imba.bet',
  'https://imba.partners',
  'https://cdn.imba.bet',
] as const;

export function isAllowedWebOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false;
  return (ALLOWED_WEB_ORIGINS as readonly string[]).includes(origin);
}
