import { WcOddsBetStatus } from '@prisma/client';

export type WcExpressLegStatus = 'WIN' | 'LOSE' | 'PENDING' | 'RETURN';

export function mapLegStatusToExpress(status: WcOddsBetStatus): WcExpressLegStatus {
  if (status === WcOddsBetStatus.VOID) return 'RETURN';
  if (status === WcOddsBetStatus.CASHED_OUT) return 'PENDING';
  return status as WcExpressLegStatus;
}

export function resolveWcExpressStatus(
  legStatuses: WcOddsBetStatus[],
): WcOddsBetStatus | null {
  if (!legStatuses.length) return null;

  const mapped = legStatuses.map(mapLegStatusToExpress);

  if (mapped.includes('LOSE')) return WcOddsBetStatus.LOSE;
  if (mapped.includes('PENDING')) return null;

  if (mapped.every((s) => s === 'WIN')) return WcOddsBetStatus.WIN;

  if (
    mapped.includes('RETURN')
    && mapped.every((s) => s === 'WIN' || s === 'RETURN')
  ) {
    return WcOddsBetStatus.VOID;
  }

  return null;
}
