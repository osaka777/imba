import { normalizeWcMarketKey } from '~/integrations/wc-odds/wc-odds-markets.util';

import { BONUS_WAGERING_RULES } from './bonus-wagering-rules.config';

const ALLOWED = new Set<string>(BONUS_WAGERING_RULES.allowedMarketKeys);

const H2H_TITLE = /^(п1|п2|x|1|2|ничья|х)$/i;
const TOTALS_TITLE = /тотал|больше|меньше|\bтб\b|\bтм\b|over|under|total/i;
const BLOCKED_TITLE = /фора|handicap|углов|карточ|пенальти|точн(ый|ого)\s+сч|обе\s+забь|double\s+chance|двойной\s+шанс/i;

export function resolveBonusMarketKey(input: {
  marketKey?: string | null;
  betInfo?: unknown;
  marketId?: unknown;
  betType?: string | null;
}): string | null {
  if (input.marketKey) {
    return normalizeWcMarketKey(input.marketKey);
  }

  const betInfo = String(input.betInfo ?? '').trim();
  const marketId = String(input.marketId ?? '').toLowerCase();

  if (input.betType === 'TOTAL' || TOTALS_TITLE.test(betInfo) || /total|тотал/.test(marketId)) {
    return 'totals';
  }

  if (H2H_TITLE.test(betInfo) || /1x2|исход|match.?winner|h2h/.test(marketId + betInfo)) {
    return 'h2h';
  }

  return null;
}

export function assertBonusMarketAllowed(input: {
  marketKey?: string | null;
  betInfo?: unknown;
  marketId?: unknown;
  betType?: string | null;
}): void {
  const betInfo = String(input.betInfo ?? '');

  if (BLOCKED_TITLE.test(betInfo)) {
    throw new Error(
      'С бонусного счёта можно ставить только на исход матча (П1/X/П2) или тотал',
    );
  }

  const key = resolveBonusMarketKey(input);
  if (!key || !ALLOWED.has(key)) {
    throw new Error(
      'С бонусного счёта разрешены только ставки на исход (1X2) и тотал',
    );
  }
}
