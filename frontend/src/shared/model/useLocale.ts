"use client";

import { useContext } from "react";

import { LocaleContext } from "~/app/providers/LocaleProvider";

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
};
