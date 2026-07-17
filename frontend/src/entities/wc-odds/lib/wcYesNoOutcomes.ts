import type { WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";

export function isYesNoMarketKey(marketKey: string): boolean {
  const stem = marketKey.replace(/^display_/i, "").replace(/_ot$/i, "");
  return (
    /_YES_NO$/i.test(stem)
    || /^COUNT_SET/i.test(stem)
    || /^(WIN1|WIN2|DRAW)_OR_(OVER|UNDER)/i.test(stem)
    || /^TEAM[12]_WILL_SCORE_/i.test(stem)
  );
}

export function isGameCountYesNoGroup(group: WcMarketGroup): boolean {
  const haystack = `${group.marketKey} ${group.label ?? ""}`;
  return /COUNT_SET/i.test(haystack) || /кол-?во\s+гейм/i.test(haystack);
}

export function isYesNoLikeGroup(group: WcMarketGroup): boolean {
  if (group.outcomes.length !== 2) return false;
  return isYesNoMarketKey(group.marketKey) || isGameCountYesNoGroup(group);
}

export function isYesOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey === "YES" || /^DISPLAY_YES/i.test(outcome.outcomeKey)) return true;

  const name = outcome.name.trim();
  if (/^да$/i.test(name) || /^да[:\s·-]/i.test(name)) return true;
  if (/\bда\b/i.test(name) && !/\bнет\b/i.test(name)) return true;

  const key = outcome.outcomeKey;
  if (/_Да\b|_YES\b|YN_YES/i.test(key)) return true;

  return false;
}

export function isNoOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey === "NO" || /^DISPLAY_NO/i.test(outcome.outcomeKey)) return true;

  const name = outcome.name.trim();
  if (/^нет$/i.test(name) || /^нет[:\s·-]/i.test(name)) return true;
  if (/\bнет\b/i.test(name) && !/\bда\b/i.test(name)) return true;

  const key = outcome.outcomeKey;
  if (/_Нет\b|_NO\b|YN_NO/i.test(key)) return true;

  return false;
}

function pairYesNoByOutcomeTypeId(
  outcomes: WcMarketOutcome[],
): { yes?: WcMarketOutcome; no?: WcMarketOutcome } {
  const ranked = outcomes.map((outcome) => {
    const fromKey = /DISPLAY_\d+_(\d+)_/i.exec(outcome.outcomeKey);
    return { outcome, rank: fromKey ? Number(fromKey[1]) : Number.MAX_SAFE_INTEGER };
  });
  ranked.sort((a, b) => a.rank - b.rank);
  if (ranked.length !== 2) return {};
  return { yes: ranked[0]!.outcome, no: ranked[1]!.outcome };
}

export function findYesNoOutcomes(group: WcMarketGroup): {
  yes?: WcMarketOutcome;
  no?: WcMarketOutcome;
} {
  const yes = group.outcomes.find(isYesOutcome);
  const no = group.outcomes.find(isNoOutcome);
  if (yes && no && yes !== no) return { yes, no };

  if (group.outcomes.length === 2 && isYesNoLikeGroup(group)) {
    return pairYesNoByOutcomeTypeId(group.outcomes);
  }

  return { yes, no };
}

export function isPlainYesNoGroup(group: WcMarketGroup): boolean {
  if (group.outcomes.length !== 2) return false;
  if (isYesNoLikeGroup(group)) return true;

  const hasYes = group.outcomes.some(isYesOutcome);
  const hasNo = group.outcomes.some(isNoOutcome);
  return hasYes && hasNo;
}
