import type { AppLocale } from "~/shared/i18n/locale";
import ru_terms from "./ru/terms";
import ru_general from "./ru/general";
import ru_privacy from "./ru/privacy";
import ru_sport_rules from "./ru/sport-rules";
import ru_responsible from "./ru/responsible";
import ru_refund from "./ru/refund";
import en_terms from "./en/terms";
import en_general from "./en/general";
import en_privacy from "./en/privacy";
import en_sport_rules from "./en/sport-rules";
import en_responsible from "./en/responsible";
import en_refund from "./en/refund";
import kk_terms from "./kk/terms";
import kk_general from "./kk/general";
import kk_privacy from "./kk/privacy";
import kk_sport_rules from "./kk/sport-rules";
import kk_responsible from "./kk/responsible";
import kk_refund from "./kk/refund";
import uz_terms from "./uz/terms";
import uz_general from "./uz/general";
import uz_privacy from "./uz/privacy";
import uz_sport_rules from "./uz/sport-rules";
import uz_responsible from "./uz/responsible";
import uz_refund from "./uz/refund";
import tr_terms from "./tr/terms";
import tr_general from "./tr/general";
import tr_privacy from "./tr/privacy";
import tr_sport_rules from "./tr/sport-rules";
import tr_responsible from "./tr/responsible";
import tr_refund from "./tr/refund";
import uk_terms from "./uk/terms";
import uk_general from "./uk/general";
import uk_privacy from "./uk/privacy";
import uk_sport_rules from "./uk/sport-rules";
import uk_responsible from "./uk/responsible";
import uk_refund from "./uk/refund";
import az_terms from "./az/terms";
import az_general from "./az/general";
import az_privacy from "./az/privacy";
import az_sport_rules from "./az/sport-rules";
import az_responsible from "./az/responsible";
import az_refund from "./az/refund";
import es_terms from "./es/terms";
import es_general from "./es/general";
import es_privacy from "./es/privacy";
import es_sport_rules from "./es/sport-rules";
import es_responsible from "./es/responsible";
import es_refund from "./es/refund";
import pt_terms from "./pt/terms";
import pt_general from "./pt/general";
import pt_privacy from "./pt/privacy";
import pt_sport_rules from "./pt/sport-rules";
import pt_responsible from "./pt/responsible";
import pt_refund from "./pt/refund";

export type InfoSlug = "terms" | "general" | "privacy" | "sport-rules" | "responsible" | "refund";

export const INFO_SECTIONS: { id: number; slug: InfoSlug; nameKey: `info.${string}` }[] = [
  { id: 1, slug: "terms", nameKey: "info.catTerms" },
  { id: 2, slug: "general", nameKey: "info.catGeneral" },
  { id: 3, slug: "privacy", nameKey: "info.catPrivacy" },
  { id: 4, slug: "sport-rules", nameKey: "info.catSportRules" },
  { id: 5, slug: "responsible", nameKey: "info.catResponsible" },
  { id: 6, slug: "refund", nameKey: "info.catRefund" },
];

const CONTENT: Record<AppLocale, Record<InfoSlug, string>> = {
  ru: {
    "terms": ru_terms,
    "general": ru_general,
    "privacy": ru_privacy,
    "sport-rules": ru_sport_rules,
    "responsible": ru_responsible,
    "refund": ru_refund,
  },
  en: {
    "terms": en_terms,
    "general": en_general,
    "privacy": en_privacy,
    "sport-rules": en_sport_rules,
    "responsible": en_responsible,
    "refund": en_refund,
  },
  kk: {
    "terms": kk_terms,
    "general": kk_general,
    "privacy": kk_privacy,
    "sport-rules": kk_sport_rules,
    "responsible": kk_responsible,
    "refund": kk_refund,
  },
  uz: {
    "terms": uz_terms,
    "general": uz_general,
    "privacy": uz_privacy,
    "sport-rules": uz_sport_rules,
    "responsible": uz_responsible,
    "refund": uz_refund,
  },
  tr: {
    "terms": tr_terms,
    "general": tr_general,
    "privacy": tr_privacy,
    "sport-rules": tr_sport_rules,
    "responsible": tr_responsible,
    "refund": tr_refund,
  },
  uk: {
    "terms": uk_terms,
    "general": uk_general,
    "privacy": uk_privacy,
    "sport-rules": uk_sport_rules,
    "responsible": uk_responsible,
    "refund": uk_refund,
  },
  az: {
    "terms": az_terms,
    "general": az_general,
    "privacy": az_privacy,
    "sport-rules": az_sport_rules,
    "responsible": az_responsible,
    "refund": az_refund,
  },
  es: {
    "terms": es_terms,
    "general": es_general,
    "privacy": es_privacy,
    "sport-rules": es_sport_rules,
    "responsible": es_responsible,
    "refund": es_refund,
  },
  pt: {
    "terms": pt_terms,
    "general": pt_general,
    "privacy": pt_privacy,
    "sport-rules": pt_sport_rules,
    "responsible": pt_responsible,
    "refund": pt_refund,
  },
};

export function getInfoHtml(locale: AppLocale, slug: InfoSlug): string {
  return CONTENT[locale]?.[slug] ?? CONTENT.ru[slug] ?? "";
}
