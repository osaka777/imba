"use client";

import { useLocale } from "~/shared/model/useLocale";

/** Locale-aware number/date formatting bound to the current UI language. */
export const useFormat = () => {
  const { format } = useLocale();
  return format;
};
