import type { MarketDto } from "~/entities/game/types/types";
import type { MessageKey, TranslateParams } from "~/shared/i18n/messages";
import { translate } from "~/shared/i18n/messages";

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

const defaultT: TranslateFn = (key, params) => translate("ru", key, params);

const pivotSuffix = (pivot?: string | number) =>
  pivot !== undefined && pivot !== null && `${pivot}` !== "" ? ` ${pivot}` : "";

const basisSuffix = (basis?: string | number) =>
  basis !== undefined && basis !== null && `${basis}` !== "" ? ` (${basis})` : "";

// Simplified betting library - using API data directly

export const createTitleForBet = (
  betInfo: Omit<MarketDto, "cf" | "isOpen" | "market" | "title"> | any,
  betType?: string,
  t: TranslateFn = defaultT,
): string => {
  // Если betInfo - это строка с данными вида "Футбол, 652006392|2|7|0", обработаем её
  if (typeof betInfo === "string" && betInfo.includes("|")) {
    const pipeIndex = betInfo.indexOf("|");
    if (pipeIndex > 0) {
      const beforePipe = betInfo.substring(0, pipeIndex);
      const numberMatch = beforePipe.match(/(\d+)\s*$/);
      if (numberMatch) {
        const startIndex = numberMatch.index!;
        const marketData = betInfo.substring(startIndex);
        const marketParts = marketData.split("|");
        if (marketParts.length >= 4) {
          const [, marketType, outcome] = marketParts;
          if (marketType === "2" || marketType === "1") {
            switch (outcome) {
              case "7":
                return t("coupon.outcomeP1");
              case "8":
                return t("coupon.outcomeDraw");
              case "9":
                return t("coupon.outcomeP2");
              default:
                return t("coupon.outcomeCode", { outcome });
            }
          }
          return t("coupon.outcomeBet", { market: marketType, outcome });
        }
      }
    }
    return betInfo;
  }

  if (betInfo && (betInfo as any).oc_name) {
    return (betInfo as any).oc_name as string;
  }

  const code = (betType || (betInfo as any)?.market || "").toString();
  const dst = (betInfo as any)?.dst as string | undefined;
  const pivot = (betInfo as any)?.pivot as string | number | undefined;
  const plrRaw = (betInfo as any)?.plr as string | number | undefined;
  const groupName = ((betInfo as any)?.oc_group_name || (betInfo as any)?.group || "").toString();
  const basis = ((betInfo as any)?.basis ?? pivot) as string | number | undefined;
  const piv = pivotSuffix(pivot);

  switch (code) {
    case "WIN__P1":
    case "WIN_RT__P1":
    case "WIN_OT__P1":
    case "WIN__1":
    case "WIN_HOME":
      return t("coupon.outcomeP1");
    case "WIN__P2":
    case "WIN_RT__P2":
    case "WIN_OT__P2":
    case "WIN__2":
    case "WIN_AWAY":
      return t("coupon.outcomeP2");
    case "WIN__PX":
    case "WIN_RT__PX":
    case "WIN_OT__PX":
    case "WIN__X":
    case "WIN_DRAW":
      return t("coupon.outcomeDraw");
    case "WIN__1X":
    case "DOUBLE_CHANCE__1X":
    case "DC__1X":
      return "1X";
    case "WIN__12":
    case "DOUBLE_CHANCE__12":
    case "DC__12":
      return "12";
    case "WIN__X2":
    case "DOUBLE_CHANCE__X2":
    case "DC__X2":
      return "X2";
  }

  if (/BOTH_TEAMS_SCORE|BTS/i.test(code) || /BOTH.*SCORE/i.test(groupName)) {
    if (dst === "YES" || /YES/.test(code)) return t("coupon.btsYes");
    if (dst === "NO" || /NO/.test(code)) return t("coupon.btsNo");
    return t("coupon.bts");
  }

  if (/TOTALS|TOTAL/i.test(code) || /тотал|ТОТАЛ/i.test(groupName)) {
    if (dst === "OVER" || /OVER/.test(code)) return t("coupon.totalOver", { pivot: piv }).trim();
    if (dst === "UNDER" || /UNDER/.test(code)) return t("coupon.totalUnder", { pivot: piv }).trim();
    return t("coupon.total", { pivot: piv }).trim();
  }

  if (/INDIVIDUAL_TOTAL/i.test(code) || /индивидуальный тотал/i.test(groupName)) {
    const team =
      plrRaw === 1 || plrRaw === "1"
        ? t("coupon.team1st")
        : plrRaw === 2 || plrRaw === "2"
          ? t("coupon.team2nd")
          : "";
    if (dst === "OVER") return t("coupon.indTotalOver", { team, pivot: piv }).trim();
    if (dst === "UNDER") return t("coupon.indTotalUnder", { team, pivot: piv }).trim();
    return t("coupon.indTotal", { team }).trim();
  }

  if (/HANDICAP|HND/i.test(code) || /HANDICAP|ФОРА/i.test(groupName)) {
    let side: string | null = null;
    if (/__P1/.test(code)) side = "1";
    if (/__P2/.test(code)) side = "2";
    if (!side && (dst === "P1" || dst === "HOME")) side = "1";
    if (!side && (dst === "P2" || dst === "AWAY")) side = "2";
    const basisText = basisSuffix(basis);
    return side
      ? t("coupon.handicapSide", { side, basis: basisText })
      : t("coupon.handicap", { basis: basisText });
  }

  if (dst === "ODD" || /ODD/.test(code)) return t("coupon.odd");
  if (dst === "EVEN" || /EVEN/.test(code)) return t("coupon.even");

  return code || t("coupon.unknownBet");
};
