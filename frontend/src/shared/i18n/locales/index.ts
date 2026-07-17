import type { AppLocale } from "../locale";

import enAuth from "./en/auth.json";
import enCommon from "./en/common.json";
import enCoupon from "./en/coupon.json";
import enDeposit from "./en/deposit.json";
import enFooter from "./en/footer.json";
import enHeader from "./en/header.json";
import enHome from "./en/home.json";
import enLang from "./en/lang.json";
import enMenu from "./en/menu.json";
import enNav from "./en/nav.json";
import enProfile from "./en/profile.json";
import enSport from "./en/sport.json";
import enSupport from "./en/support.json";
import ruAuth from "./ru/auth.json";
import ruCommon from "./ru/common.json";
import ruCoupon from "./ru/coupon.json";
import ruDeposit from "./ru/deposit.json";
import ruFooter from "./ru/footer.json";
import ruHeader from "./ru/header.json";
import ruHome from "./ru/home.json";
import ruLang from "./ru/lang.json";
import ruMenu from "./ru/menu.json";
import ruNav from "./ru/nav.json";
import ruProfile from "./ru/profile.json";
import ruSport from "./ru/sport.json";
import ruSupport from "./ru/support.json";

/** Namespace files — add a new JSON here when splitting messages further. */
export const MESSAGE_NAMESPACES = [
  "nav",
  "auth",
  "menu",
  "deposit",
  "lang",
  "common",
  "coupon",
  "sport",
  "home",
  "footer",
  "header",
  "support",
  "profile",
] as const;

export type MessageNamespace = (typeof MESSAGE_NAMESPACES)[number];

type NamespaceBundle = Record<MessageNamespace, Record<string, string>>;

const ruNamespaces = {
  nav: ruNav,
  auth: ruAuth,
  menu: ruMenu,
  deposit: ruDeposit,
  lang: ruLang,
  common: ruCommon,
  coupon: ruCoupon,
  sport: ruSport,
  home: ruHome,
  footer: ruFooter,
  header: ruHeader,
  support: ruSupport,
  profile: ruProfile,
} satisfies NamespaceBundle;

const enNamespaces = {
  nav: enNav,
  auth: enAuth,
  menu: enMenu,
  deposit: enDeposit,
  lang: enLang,
  common: enCommon,
  coupon: enCoupon,
  sport: enSport,
  home: enHome,
  footer: enFooter,
  header: enHeader,
  support: enSupport,
  profile: enProfile,
} satisfies NamespaceBundle;

/** Message keys are derived from the Russian source of truth. */
export type MessageKey = {
  [NS in MessageNamespace]: `${NS}.${keyof (typeof ruNamespaces)[NS] & string}`;
}[MessageNamespace];

export type FlatDictionary = Record<MessageKey, string>;

function flattenNamespaces(namespaces: NamespaceBundle): FlatDictionary {
  const dictionary = {} as FlatDictionary;

  for (const namespace of MESSAGE_NAMESPACES) {
    const messages = namespaces[namespace];
    for (const [key, value] of Object.entries(messages)) {
      const messageKey = `${namespace}.${key}` as MessageKey;
      dictionary[messageKey] = value;
    }
  }

  return dictionary;
}

export const localeNamespaces: Record<AppLocale, NamespaceBundle> = {
  ru: ruNamespaces,
  en: enNamespaces,
};

export const dictionaries: Record<AppLocale, FlatDictionary> = {
  ru: flattenNamespaces(ruNamespaces),
  en: flattenNamespaces(enNamespaces),
};
