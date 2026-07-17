import { AsyncLocalStorage } from "node:async_hooks";

const localeContext = new AsyncLocalStorage<string>();

/**
 * Bind locale for the full Express/Nest request lifetime.
 * Must wrap `next` inside `run` (not enterWith) so async handlers keep the store
 * and it does not leak across requests.
 */
export function runWithLocale<T>(locale: string, fn: () => T): T {
  return localeContext.run(locale, fn);
}

export function getRequestLocale(): string | undefined {
  return localeContext.getStore();
}
