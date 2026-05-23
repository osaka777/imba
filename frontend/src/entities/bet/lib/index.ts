import { MarketDto } from "~/entities/game/types/types";

// Simplified betting library - using API data directly

export const createTitleForBet = (
  betInfo: Omit<MarketDto, "cf" | "isOpen" | "market" | "title"> | any,
  betType?: string,
): string => {
  // Если betInfo - это строка с данными вида "Футбол, 652006392|2|7|0", обработаем её
  if (typeof betInfo === 'string' && betInfo.includes('|')) {
    // Ищем часть с | в строке
    const pipeIndex = betInfo.indexOf('|');
    if (pipeIndex > 0) {
      // Находим начало числовой части (ищем последнее число перед |)
      const beforePipe = betInfo.substring(0, pipeIndex);
      const numberMatch = beforePipe.match(/(\d+)\s*$/);
      if (numberMatch) {
        const startIndex = numberMatch.index!;
        const marketData = betInfo.substring(startIndex);
        const marketParts = marketData.split('|');
        if (marketParts.length >= 4) {
          const [, marketType, outcome] = marketParts;
          // Базовая обработка основных типов ставок
          if (marketType === '2') { // WIN market
            switch (outcome) {
              case '7': return 'П1';
              case '8': return 'Ничья';
              case '9': return 'П2';
              default: return `Исход ${outcome}`;
            }
          }
          // Для других типов рынков
          if (marketType === '1') { // Другой тип рынка
            switch (outcome) {
              case '7': return 'П1';
              case '8': return 'Ничья';
              case '9': return 'П2';
              default: return `Исход ${outcome}`;
            }
          }
          return `Ставка ${marketType}:${outcome}`;
        }
      }
    }
    return betInfo; // Возвращаем как есть, если не смогли распарсить
  }

  // Возвращаем oc_name если есть
  if (betInfo && (betInfo as any).oc_name) {
    return (betInfo as any).oc_name as string;
  }

  // Fallbacks based on market/betType codes
  const code = (betType || (betInfo as any)?.market || "").toString();
  const dst = (betInfo as any)?.dst as string | undefined;
  const pivot = (betInfo as any)?.pivot as string | number | undefined;
  const plrRaw = (betInfo as any)?.plr as string | number | undefined;
  const groupName = ((betInfo as any)?.oc_group_name || (betInfo as any)?.group || "").toString();
  const basis = ((betInfo as any)?.basis ?? pivot) as string | number | undefined;

  // WIN outcomes
  switch (code) {
    case "WIN__P1":
    case "WIN_RT__P1":
    case "WIN_OT__P1":
    case "WIN__1":
    case "WIN_HOME":
      return "П1";
    case "WIN__P2":
    case "WIN_RT__P2":
    case "WIN_OT__P2":
    case "WIN__2":
    case "WIN_AWAY":
      return "П2";
    case "WIN__PX":
    case "WIN_RT__PX":
    case "WIN_OT__PX":
    case "WIN__X":
    case "WIN_DRAW":
      return "Ничья";
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

  // BOTH_TEAMS_SCORE (Обе забьют)
  if (/BOTH_TEAMS_SCORE|BTS/i.test(code) || /BOTH.*SCORE/i.test(groupName)) {
    if (dst === 'YES' || /YES/.test(code)) {
      return 'Обе забьют - Да';
    }
    if (dst === 'NO' || /NO/.test(code)) {
      return 'Обе забьют - Нет';
    }
    return 'Обе забьют';
  }

  // TOTALS (Тоталы)
  if (/TOTALS|TOTAL/i.test(code) || /тотал|ТОТАЛ/i.test(groupName)) {
    if (dst === 'OVER' || /OVER/.test(code)) {
      return `ТБ${pivot ? ` ${pivot}` : ''}`.trim();
    }
    if (dst === 'UNDER' || /UNDER/.test(code)) {
      return `ТМ${pivot ? ` ${pivot}` : ''}`.trim();
    }
    return `Тотал${pivot ? ` ${pivot}` : ''}`.trim();
  }

  // INDIVIDUAL TOTALS (Индивидуальные тоталы)
  if (/INDIVIDUAL_TOTAL/i.test(code) || /индивидуальный тотал/i.test(groupName)) {
    const teamIndex = plrRaw === 1 || plrRaw === '1' ? '1-го' : plrRaw === 2 || plrRaw === '2' ? '2-го' : '';
    if (dst === 'OVER') {
      return `Индивидуальный тотал ${teamIndex} ТБ${pivot ? ` ${pivot}` : ''}`.trim();
    }
    if (dst === 'UNDER') {
      return `Индивидуальный тотал ${teamIndex} ТМ${pivot ? ` ${pivot}` : ''}`.trim();
    }
    return `Индивидуальный тотал ${teamIndex}`.trim();
  }

  // Handicap (Фора)
  if (/HANDICAP|HND/i.test(code) || /HANDICAP|ФОРА/i.test(groupName)) {
    let side: string | null = null;
    if (/__P1/.test(code)) side = '1';
    if (/__P2/.test(code)) side = '2';
    if (!side && (dst === 'P1' || dst === 'HOME')) side = '1';
    if (!side && (dst === 'P2' || dst === 'AWAY')) side = '2';
    const basisText = basis !== undefined && basis !== null && `${basis}` !== '' ? ` (${basis})` : '';
    return side ? `Фора ${side}${basisText}` : `Фора${basisText}`;
  }

  // ODD/EVEN (Чёт/Нечёт)
  if (dst === 'ODD' || /ODD/.test(code)) {
    return 'Нечёт';
  }
  if (dst === 'EVEN' || /EVEN/.test(code)) {
    return 'Чёт';
  }

  // Default: show cleaned code if present, otherwise generic label
  return code || "Неизвестная ставка";
};
