import { getRequestLocale } from '~/common/locale/locale.context';

/** Locales Olimpbet v2 /events API accepts for competitor & market labels. */
export type OlimpbetApiLocale = 'ru' | 'en';

export function resolveOlimpbetApiLocale(
  explicit?: string | null,
): OlimpbetApiLocale {
  const raw = (explicit ?? getRequestLocale() ?? 'ru').toLowerCase().split('-')[0];
  return raw === 'en' ? 'en' : 'ru';
}
