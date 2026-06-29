import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import { olimpbetSportKeyToSlug } from '../olimpbet-wc/olimpbet-sport.util';
import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';

import { advanceMatchState } from './wc-match-state-tracker.util';
import type { WcMatchState } from './wc-match-state.types';
import { WcOddsSettlementService } from './wc-odds-settlement.service';

@Injectable()
export class WcEventMatchStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly settlement: WcOddsSettlementService,
  ) {}

  buildMatchState(
    detail: OlimpbetEventDetail,
    sportKey: string,
    prevStateJson?: unknown,
  ): WcMatchState {
    return advanceMatchState(prevStateJson, detail, olimpbetSportKeyToSlug(sportKey));
  }

  /** Update persisted state and settle determinable pending bets from verified feed math. */
  async refreshAndSettle(
    eventId: string,
    sportKey: string,
    detail: OlimpbetEventDetail,
    prevStateJson?: unknown,
  ): Promise<WcMatchState> {
    const matchState = this.buildMatchState(detail, sportKey, prevStateJson);

    await this.prisma.wcOddsEvent.update({
      where: { id: eventId },
      data: { matchStateJson: matchState as object },
    });

    const score = this.olimpbet.extractScore(detail);
    if (score.homeScore != null && score.awayScore != null) {
      await this.settlement.trySettleDeterminateBets(
        eventId,
        score.homeScore,
        score.awayScore,
        detail,
        matchState,
      );
    }

    return matchState;
  }
}
