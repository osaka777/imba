import { isBasketballLikeSport } from "~/entities/wc-odds/lib/wcSportKinds";
import { translate, type MessageKey, type TranslateParams } from "~/shared/i18n/messages";

export type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

function resolveT(t?: TranslateFn): TranslateFn {
  return t ?? ((key, params) => translate("ru", key, params));
}

/** Tab label shown in the market filter row (basketball halves include quarter hint). */
export function formatPeriodTabLabel(tabKey: string, sport?: string, t?: TranslateFn): string {
  const tr = resolveT(t);
  if (!isBasketballLikeSport(sport)) return tabKey;
  if (tabKey === "1-й тайм") return tr("wc.half1Tab");
  if (tabKey === "2-й тайм") return tr("wc.half2Tab");
  return tabKey;
}

/** Rename football-style half scopes for basketball UI and bet titles. */
export function applySportPeriodScopeLabels(text: string, sport?: string, t?: TranslateFn): string {
  if (!isBasketballLikeSport(sport) || !text) return text;

  const tr = resolveT(t);

  return text
    .replace(/\b1-й\s+тайм\b/gi, tr("wc.half1"))
    .replace(/\b2-й\s+тайм\b/gi, tr("wc.half2"))
    .replace(/\b1-го\s+тайма\b/gi, tr("wc.half1Gen"))
    .replace(/\b2-го\s+тайма\b/gi, tr("wc.half2Gen"))
    .replace(/\b1-м\s+тайме\b/gi, tr("wc.half1Prep"))
    .replace(/\b2-м\s+тайме\b/gi, tr("wc.half2Prep"));
}
