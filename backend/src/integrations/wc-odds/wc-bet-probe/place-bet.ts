import { WcOddsBetStatus } from '@prisma/client';

import type { WcBetProbeConfig } from './config';
import { WcBetProbeHttpError, probeFetchJson } from './http';
import type { WcBetProbeCandidate, WcBetProbeFinding } from './types';

type PlacedBetResponse = {
  id?: number;
  status?: WcOddsBetStatus;
  eventId?: string;
  marketKey?: string;
  outcomeKey?: string;
  line?: string | null;
  createdAt?: string;
};

type MyBetRow = {
  id: number;
  status: WcOddsBetStatus;
  eventId?: string;
  marketKey?: string;
  groupKey?: string | null;
  outcomeKey?: string | null;
  line?: string | null;
  createdAt?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Unknown error';
  const err = body as { message?: string | { message?: string } };
  if (typeof err.message === 'string') return err.message;
  if (typeof err.message === 'object' && err.message?.message) return err.message.message;
  return JSON.stringify(body).slice(0, 300);
}

export async function placeProbeBet(
  config: WcBetProbeConfig,
  eventId: string,
  candidate: WcBetProbeCandidate,
): Promise<{ ok: true; bet: PlacedBetResponse; placedAtMs: number } | { ok: false; finding: WcBetProbeFinding }> {
  const body = {
    eventId,
    marketKey: candidate.marketKey,
    groupKey: candidate.groupKey,
    outcomeKey: candidate.outcome.outcomeKey,
    line: candidate.line ?? undefined,
    outcomeName: candidate.outcomeName,
    stake: config.stake,
    currencyCode: config.currencyCode,
    clientOdds: candidate.clientOdds,
    acceptOddsChange: config.acceptOddsChange,
  };

  try {
    const bet = await probeFetchJson<PlacedBetResponse>(config, '/api/feed/bets', {
      method: 'POST',
      token: config.token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: true, bet, placedAtMs: Date.now() };
  } catch (err) {
    const httpErr = err instanceof WcBetProbeHttpError ? err : null;
    const message = httpErr ? extractErrorMessage(httpErr.body) : (err as Error).message;
    return {
      ok: false,
      finding: {
        severity: 'error',
        code: 'place_bet_rejected',
        message: `User flow failed to place bet: ${message}`,
        eventId,
        marketKey: candidate.marketKey,
        groupKey: candidate.groupKey,
        outcomeKey: candidate.outcome.outcomeKey,
        line: candidate.line,
        meta: {
          httpStatus: httpErr?.status,
          outcomeName: candidate.outcomeName,
          clientOdds: candidate.clientOdds,
        },
      },
    };
  }
}

export async function pollBetStatus(
  config: WcBetProbeConfig,
  betId: number,
  placedAtMs: number,
): Promise<{ status: WcOddsBetStatus; observedAtMs: number } | null> {
  const deadline = Date.now() + config.pollAfterBetMs;
  while (Date.now() < deadline) {
    try {
      const hit = await probeFetchJson<MyBetRow>(
        config,
        `/api/feed/bets/${betId}`,
        { token: config.token },
      );
      const isTerminal =
        hit.status === WcOddsBetStatus.WIN
        || hit.status === WcOddsBetStatus.LOSE
        || hit.status === WcOddsBetStatus.VOID;
      if (isTerminal || Date.now() - placedAtMs >= config.pollAfterBetMs - 500) {
        return { status: hit.status, observedAtMs: Date.now() };
      }
    } catch {
      // bet row may not be ready yet
    }
    await sleep(400);
  }
  return null;
}

export function validateUiVsApiOffer(
  candidate: WcBetProbeCandidate,
  bettingOpen: boolean,
  completed: boolean,
): WcBetProbeFinding | null {
  if (completed || !bettingOpen) {
    return {
      severity: 'warning',
      code: 'offered_while_betting_closed',
      message: `Outcome priced at ${candidate.clientOdds} but match betting is closed.`,
      marketKey: candidate.marketKey,
      groupKey: candidate.groupKey,
      outcomeKey: candidate.outcome.outcomeKey,
      line: candidate.line,
    };
  }
  return null;
}
