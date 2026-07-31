import { cookies } from "next/headers";

import { makeMetadata } from "~/shared/lib/metadata";
import {
  LOCALE_STORAGE_KEY,
  normalizeAppLocale,
  type AppLocale,
} from "~/shared/i18n/locale";
import { translate, type MessageKey, type TranslateParams } from "~/shared/i18n/messages";

/** Read UI locale from cookie for SSR / generateMetadata. Safe default: ru. */
export async function resolveRequestLocale(): Promise<AppLocale> {
  try {
    const jar = await cookies();
    const raw = jar.get(LOCALE_STORAGE_KEY)?.value;
    return normalizeAppLocale(raw) ?? "ru";
  } catch {
    return "ru";
  }
}

type SeoOptions = {
  descriptionKey?: MessageKey;
  path?: string;
  params?: TranslateParams;
  noIndex?: boolean;
};

/** Localized page metadata from cookie locale (falls back to ru). */
export async function makeSeoMetadata(
  titleKey: MessageKey,
  options?: SeoOptions,
) {
  const locale = await resolveRequestLocale();
  const title = translate(locale, titleKey, options?.params);
  const description = translate(
    locale,
    options?.descriptionKey ?? "common.seoSiteDesc",
    options?.params,
  );
  return makeMetadata(title, {
    description,
    path: options?.path,
    noIndex: options?.noIndex,
  });
}
