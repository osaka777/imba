import { WcOddsBetStatus } from '@prisma/client';

export type WcExpressLegStatus = 'WIN' | 'LOSE' | 'PENDING' | 'RETURN';

export type ExpressLegSettlementInput = {
  status: WcOddsBetStatus;
  odds: number;
};

export function mapLegStatusToExpress(status: WcOddsBetStatus): WcExpressLegStatus {
  if (status === WcOddsBetStatus.VOID) return 'RETURN';
  if (status === WcOddsBetStatus.CASHED_OUT) return 'PENDING';
  return status as WcExpressLegStatus;
}

/**
 * Parent express status once every leg is terminal (no PENDING).
 * VOID leg = odds 1.0 (express continues); full VOID only when all legs voided.
 */
export function resolveWcExpressStatus(
  legStatuses: WcOddsBetStatus[],
): WcOddsBetStatus | null {
  if (!legStatuses.length) return null;

  const mapped = legStatuses.map(mapLegStatusToExpress);

  if (mapped.includes('LOSE')) return WcOddsBetStatus.LOSE;
  if (mapped.includes('PENDING')) return null;

  if (mapped.every((s) => s === 'RETURN')) return WcOddsBetStatus.VOID;

  if (mapped.every((s) => s === 'WIN' || s === 'RETURN')) {
    return WcOddsBetStatus.WIN;
  }

  return null;
}

/** Combined odds for settled express: VOID legs contribute ×1.0. */
export function resolveExpressCombinedOdds(
  legs: ExpressLegSettlementInput[],
): number | null {
  let combined = 1;

  for (const leg of legs) {
    const mapped = mapLegStatusToExpress(leg.status);
    if (mapped === 'RETURN') continue;
    if (mapped === 'WIN') {
      if (!Number.isFinite(leg.odds) || leg.odds < 1) return null;
      combined *= leg.odds;
      continue;
    }
    return null;
  }

  return Math.round(combined * 100) / 100;
}

export function computeExpressWinPayout(
  stake: number,
  legs: ExpressLegSettlementInput[],
): number | null {
  if (!Number.isFinite(stake) || stake <= 0) return null;
  const combined = resolveExpressCombinedOdds(legs);
  if (combined == null) return null;
  return Math.round(stake * combined * 100) / 100;
}
