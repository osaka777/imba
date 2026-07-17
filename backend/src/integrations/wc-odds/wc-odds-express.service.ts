import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OperationSource,
  OperationStatus,
  OperationType,
  WcOddsBetStatus,
  WcOddsPick,
  WcOddsEvent,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';
import {
  computeMainAccountBetDebit,
  toStakeNumber,
} from '~/shared/utils/balance-fractional-reserve.util';

import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { isMarketScopeFinalized } from '../olimpbet-wc/olimpbet-score-scope.util';
import { olimpbetSportKeyToSlug } from '../olimpbet-wc/olimpbet-sport.util';

import { buildBetPlacementContext } from './wc-bet-placement-context.util';
import { isWcBettingOpen } from './wc-betting.util';
import { advanceMatchState } from './wc-match-state-tracker.util';
import { parseMatchState } from './wc-match-state.types';
import {
  findMarketGroup,
  findMarketOutcome,
  findOutcomeOdds,
  isTotalsMarketKey,
  isWcBetPlacementAllowed,
  normalizeWcMarketKey,
  outcomeKeyToPick,
  type WcGroupedMarkets,
} from './wc-odds-markets.util';
import { WcOddsBetService } from './wc-odds-bet.service';
import { resolveBetPlacementScope } from './wc-scope-market-filter.util';
import { buildTotalsOutcomeName } from './wc-totals-outcome-name.util';
import { olimpbetIdFromWcEventId } from './wc-slug.util';
import { toPublicEventId } from './wc-public.util';
import { WcOddsRealtimeService } from './wc-odds-realtime.service';

export type WcExpressLegInput = {
  eventId: string;
  pick?: WcOddsPick;
  marketKey?: string;
  groupKey?: string;
  outcomeKey?: string;
  line?: string;
  outcomeName?: string;
  clientOdds?: number;
};

type ResolvedLeg = {
  event: WcOddsEvent;
  pick: WcOddsPick | null;
  marketKey: string;
  outcomeKey: string | null;
  line: string | null;
  outcomeName: string | null;
  odds: number;
  placementContext: object | null;
};

@Injectable()
export class WcOddsExpressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly betService: WcOddsBetService,
    private readonly realtime: WcOddsRealtimeService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly operationService: OperationService,
    private readonly config: ConfigService,
  ) {}

  async placeExpressBet(params: {
    userId: number;
    stake: number;
    currencyCode: string;
    legs: WcExpressLegInput[];
    acceptOddsChange?: boolean;
  }) {
    if (!this.olimpbet.isEnabled()) {
      throw new BadRequestException('WC odds module is disabled');
    }

    const minLegs = Number(this.config.get<string>('WC_EXPRESS_MIN_LEGS', '2'));
    const maxLegs = Number(this.config.get<string>('WC_EXPRESS_MAX_LEGS', '5'));
    const minStake = Number(this.config.get<string>('WC_ODDS_MIN_STAKE', '100'));
    const maxStake = Number(this.config.get<string>('WC_ODDS_MAX_STAKE', '1000000'));

    if (params.legs.length < minLegs || params.legs.length > maxLegs) {
      throw new BadRequestException(`Express must have ${minLegs}–${maxLegs} events`);
    }

    const eventIds = params.legs.map((l) => l.eventId);
    if (new Set(eventIds).size !== eventIds.length) {
      throw new BadRequestException('Duplicate events in express are not allowed');
    }

    if (!Number.isFinite(params.stake) || params.stake < minStake || params.stake > maxStake) {
      throw new BadRequestException(`Stake must be between ${minStake} and ${maxStake}`);
    }

    const resolved = await Promise.all(
      params.legs.map((leg) => this.resolveLeg(leg, params.acceptOddsChange === true)),
    );

    let combinedOdds = 1;
    for (const leg of resolved) {
      combinedOdds *= leg.odds;
    }
    combinedOdds = Math.round(combinedOdds * 100) / 100;

    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currencyCode: {
          userId: params.userId,
          currencyCode: params.currencyCode,
        },
      },
    });
    if (!balance || balance.amount.lessThan(new Decimal(params.stake))) {
      throw new BadRequestException('Insufficient funds');
    }

    const effectiveStakeNum = toStakeNumber(
      computeMainAccountBetDebit(balance.amount, params.stake),
    );
    if (effectiveStakeNum < minStake) {
      throw new BadRequestException(`Stake must be between ${minStake} and ${maxStake}`);
    }

    const stake = new Decimal(effectiveStakeNum);
    const potentialPayout = stake.mul(combinedOdds).toDecimalPlaces(2);
    const zero = new Decimal(0);

    const express = await this.prisma.$transaction(async (tx) => {
      await this.operationService.create(tx, params.userId, {
        amount: stake,
        currencyCode: params.currencyCode,
        source: OperationSource.WC_BET,
        status: OperationStatus.SUCCESS,
        type: OperationType.OUTCOME,
        meta: { wcExpress: true, legCount: resolved.length },
      });

      const parent = await tx.wcOddsExpressBet.create({
        data: {
          userId: params.userId,
          stake,
          combinedOdds: new Decimal(combinedOdds),
          potentialPayout,
          currencyCode: params.currencyCode,
          status: WcOddsBetStatus.PENDING,
        },
      });

      for (const leg of resolved) {
        await tx.wcOddsBet.create({
          data: {
            userId: params.userId,
            eventId: leg.event.id,
            pick: leg.pick ?? undefined,
            marketKey: leg.marketKey,
            outcomeKey: leg.outcomeKey,
            line: leg.line,
            outcomeName: leg.outcomeName,
            odds: new Decimal(leg.odds),
            stake: zero,
            potentialPayout: zero,
            currencyCode: params.currencyCode,
            status: WcOddsBetStatus.PENDING,
            placementContextJson: leg.placementContext as object | undefined,
            wcExpressBetId: parent.id,
          },
        });
      }

      return parent;
    });

    return { id: express.id, combinedOdds: combinedOdds.toFixed(2), potentialPayout: potentialPayout.toFixed(2) };
  }

  private async resolveLeg(
    params: WcExpressLegInput,
    acceptOddsChange: boolean,
  ): Promise<ResolvedLeg> {
    let event = await this.betService.findEventByRef(params.eventId);
    if (!event) throw new NotFoundException('Event not found');

    const publicRef = event.slug?.trim() || toPublicEventId(event.id);
    const rawMarketKey = params.marketKey || 'h2h';

    const placementSnapshot = await this.realtime.resolveBetPlacementSnapshot(
      publicRef,
      event,
      {
        marketKey: rawMarketKey,
        outcomeKey: params.outcomeKey ?? null,
        line: params.line ?? null,
        groupKey: params.groupKey ?? null,
      },
    );
    if (!placementSnapshot) {
      throw new NotFoundException('Event not found');
    }

    const { groupedMarkets, bettingOpen, main: placementDetail } = placementSnapshot;

    if (bettingOpen === false || !isWcBettingOpen(event.completed, event.commenceTime)) {
      throw new BadRequestException('Betting closed for this match');
    }

    if (!isWcBetPlacementAllowed(rawMarketKey, params.outcomeKey)) {
      throw new BadRequestException('This market is not available for betting');
    }

    const marketKey = normalizeWcMarketKey(rawMarketKey);
    let pick: WcOddsPick | null = params.pick ?? null;
    let outcomeKey = params.outcomeKey ?? null;
    let line = params.line ?? null;
    let outcomeName = params.outcomeName ?? null;
    const groupKey = params.groupKey ?? null;
    let odds: number | null = null;

    if (marketKey === 'h2h') {
      if (!pick && outcomeKey) pick = outcomeKeyToPick(outcomeKey);
      if (!outcomeKey && pick) outcomeKey = pick;
      if (!pick || !outcomeKey) throw new BadRequestException('Pick required for 1X2 market');
      odds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey, null, groupKey)
        ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, null, groupKey);
      if (odds == null) {
        const oddsMap: Record<WcOddsPick, Decimal | null> = {
          [WcOddsPick.HOME]: event.oddsHome,
          [WcOddsPick.DRAW]: event.oddsDraw,
          [WcOddsPick.AWAY]: event.oddsAway,
        };
        const dec = oddsMap[pick];
        odds = dec ? Number(dec) : null;
      }
      if (!outcomeName) {
        outcomeName = pick === WcOddsPick.HOME ? 'П1' : pick === WcOddsPick.DRAW ? 'X' : 'П2';
      }
    } else {
      if (!outcomeKey) throw new BadRequestException('Outcome required');
      if (isTotalsMarketKey(marketKey) && !line) {
        const parts = outcomeKey.split('_');
        line = parts.slice(1).join('_') || null;
      }
      odds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey, line, groupKey)
        ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, line, groupKey);
    }

    if (odds == null || !Number.isFinite(odds)) {
      throw new BadRequestException('Odds unavailable for this outcome');
    }

    const matchedOutcome = outcomeKey
      ? findMarketOutcome(groupedMarkets, rawMarketKey, outcomeKey, line, groupKey)
        ?? findMarketOutcome(groupedMarkets, marketKey, outcomeKey, line, groupKey)
      : null;
    if (matchedOutcome?.suspended) {
      throw new BadRequestException('This outcome is temporarily suspended');
    }

    const totalsGroupLabel = isTotalsMarketKey(marketKey)
      ? findMarketGroup(groupedMarkets, rawMarketKey, outcomeKey ?? '', line, groupKey)?.label ?? null
      : null;

    const oddsTolerance = Number(this.config.get<string>('WC_ODDS_TOLERANCE', '0.02'));
    if (
      !acceptOddsChange
      && params.clientOdds != null
      && Number.isFinite(params.clientOdds)
      && Math.abs(params.clientOdds - odds) > oddsTolerance
    ) {
      throw new BadRequestException({
        message: 'Odds have changed',
        coefficientChanged: true,
        originalCoefficient: params.clientOdds,
        actualCoefficient: odds,
      });
    }

    const homeScore = event.homeScore ?? 0;
    const awayScore = event.awayScore ?? 0;
    let placementContext = buildBetPlacementContext({
      marketKey: rawMarketKey,
      outcomeKey,
      homeScore,
      awayScore,
      matchState: parseMatchState(event.matchStateJson),
      totalsGroupLabel,
    });

    const olimpbetId = olimpbetIdFromWcEventId(event.id);
    if (placementDetail && olimpbetId) {
      const scope = resolveBetPlacementScope({
        marketKey: rawMarketKey,
        outcomeKey,
        outcomeName,
        groupKey,
        totalsGroupLabel,
      });
      if (scope && isMarketScopeFinalized(placementDetail, scope)) {
        throw new BadRequestException('Betting closed for this period');
      }
      const score = this.olimpbet.extractScore(placementDetail);
      const matchState = advanceMatchState(
        event.matchStateJson,
        placementDetail,
        olimpbetSportKeyToSlug(event.sportKey),
      );
      placementContext = buildBetPlacementContext({
        marketKey: rawMarketKey,
        outcomeKey,
        homeScore: score.homeScore ?? homeScore,
        awayScore: score.awayScore ?? awayScore,
        detail: placementDetail,
        matchState,
        totalsGroupLabel,
      });
    }

    if (isTotalsMarketKey(marketKey) && outcomeKey) {
      const matchedGroup = findMarketGroup(groupedMarkets, rawMarketKey, outcomeKey, line, groupKey);
      if (matchedGroup) {
        outcomeName = buildTotalsOutcomeName(matchedGroup.label, line, outcomeKey, outcomeName);
      }
    }

    return {
      event,
      pick,
      marketKey: rawMarketKey,
      outcomeKey,
      line,
      outcomeName,
      odds,
      placementContext,
    };
  }
}
