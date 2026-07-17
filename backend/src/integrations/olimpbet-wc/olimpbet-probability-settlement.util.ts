import type { OlimpbetEventDetail } from './olimpbet-wc.types';

export type OlimpbetProbabilityResult = 'WIN' | 'LOSE' | 'VOID';

export function parseDisplayOutcomeKey(
  outcomeKey: string,
): { marketId: number; outcomeTypeId: number } | null {
  const match = /^DISPLAY_(\d+)_(\d+)(?:_|$)/.exec(outcomeKey);
  if (!match) return null;
  const marketId = Number(match[1]);
  const outcomeTypeId = Number(match[2]);
  if (!Number.isFinite(marketId) || !Number.isFinite(outcomeTypeId)) return null;
  return { marketId, outcomeTypeId };
}

/** Scope encoded in DISPLAY outcomeKey tail, e.g. PARAMETER_SET_NUMBER:3|PARAMETER_GAME_NUMBER:8 */
export function parseDisplayOutcomeParameters(outcomeKey: string): Record<string, string> {
  const params: Record<string, string> = {};
  const match = /^DISPLAY_\d+_\d+_?(.*)$/.exec(outcomeKey);
  const tail = match?.[1]?.trim() ?? '';
  if (!tail) return params;

  for (const chunk of tail.split('|')) {
    const colon = chunk.indexOf(':');
    if (colon <= 0) continue;
    params[chunk.slice(0, colon)] = chunk.slice(colon + 1);
  }

  return params;
}

function parametersMatch(
  expected: Record<string, string>,
  actual: Array<{ type: string; value: string }> | null | undefined,
): boolean {
  const keys = Object.keys(expected);
  if (keys.length === 0) return true;
  if (!actual?.length) return false;

  const actualMap = Object.fromEntries(actual.map((p) => [p.type, p.value]));
  return keys.every((key) => actualMap[key] === expected[key]);
}

function statusToResult(status: string): OlimpbetProbabilityResult | null {
  const upper = status.toUpperCase();
  if (/WON|WINNER|\bWIN\b/.test(upper)) return 'WIN';
  if (/LOST|LOSER|\bLOSE\b/.test(upper)) return 'LOSE';
  if (/VOID|CANCEL|REFUND/.test(upper)) return 'VOID';
  return null;
}

function probabilityToResult(
  prob: { odd: number; tradingStatus?: string | null },
): OlimpbetProbabilityResult | null {
  const fromStatus = statusToResult(prob.tradingStatus ?? '');
  if (fromStatus) return fromStatus;

  const status = (prob.tradingStatus ?? '').toUpperCase();
  if (status.includes('RESULTED') || status.includes('SETTLED') || status.includes('CLOSED')) {
    if (prob.odd >= 1 && prob.odd < 1.01) return 'VOID';
    if (prob.odd < 1) return 'LOSE';
  }

  return null;
}

export function resolveOlimpbetProbabilityResult(
  detail: OlimpbetEventDetail,
  marketId: number,
  outcomeTypeId: number,
  scopeParameters?: Record<string, string>,
): OlimpbetProbabilityResult | null {
  for (const market of detail.probabilities?.markets ?? []) {
    if (market.marketId !== marketId) continue;

    for (const prob of market.probabilities ?? []) {
      if (prob.outcomeTypeId !== outcomeTypeId) continue;
      if (!parametersMatch(scopeParameters ?? {}, prob.parameters)) continue;

      const result = probabilityToResult(prob);
      if (result) return result;
    }
  }

  return null;
}

export function resolveDisplayOutcomeResult(
  detail: OlimpbetEventDetail,
  outcomeKey: string,
): OlimpbetProbabilityResult | null {
  const normalizedKey = outcomeKey.replace(/_base$/i, '');
  const parsed = parseDisplayOutcomeKey(normalizedKey);
  if (!parsed) return null;

  const scopeParameters = parseDisplayOutcomeParameters(normalizedKey);
  return resolveOlimpbetProbabilityResult(
    detail,
    parsed.marketId,
    parsed.outcomeTypeId,
    scopeParameters,
  );
}
