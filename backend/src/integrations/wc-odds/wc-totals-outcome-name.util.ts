import { parseMarketScopeFromText } from '../olimpbet-wc/olimpbet-score-scope.util';

function totalsSideLabel(outcomeKey: string | null | undefined): string {
  if (outcomeKey?.startsWith('OVER')) return 'Больше';
  if (outcomeKey?.startsWith('UNDER')) return 'Меньше';
  return '';
}

/** Build coupon title with set/game scope preserved for tennis totals. */
export function buildTotalsOutcomeName(
  groupLabel: string,
  line: string | null | undefined,
  outcomeKey: string | null | undefined,
  fallback?: string | null,
): string {
  const side = totalsSideLabel(outcomeKey);
  const lineStr = line?.trim() ?? '';
  const existing = fallback?.trim() ?? '';

  if (existing && parseMarketScopeFromText(existing)) return existing;

  const setScope = groupLabel.match(/(\d+-[йи]\s+сет)/i)?.[1];
  const gameScope = groupLabel.match(/(\d+-[йи]\s+гейм)/i)?.[1];

  let base = 'Тотал';
  if (/тотал/i.test(groupLabel)) {
    base = groupLabel.replace(/\s*[\d.,]+\s*$/, '').trim() || groupLabel;
    base = dedupeScopeTokens(base);
  } else if (setScope) {
    base = gameScope ? `${setScope}, ${gameScope} — Тотал` : `${setScope} — Тотал`;
  } else if (gameScope) {
    base = `${gameScope} — Тотал`;
  }

  if (lineStr && side) {
    if (lineAlreadyInLabel(base, lineStr)) return `${base} — ${side}`;
    return `${base} ${lineStr} — ${side}`;
  }

  return existing || base;
}

function dedupeScopeTokens(label: string): string {
  return label.replace(
    /(\d+-[йи]\s+(?:сет|гейм|тайм|четверть))(?:\s+\1)+/gi,
    '$1',
  );
}

function lineAlreadyInLabel(label: string, line: string): boolean {
  const pattern = line.replace('.', '[.,]');
  return new RegExp(`\\b${pattern}\\b`).test(label);
}
