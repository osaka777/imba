import { Injectable, Logger } from '@nestjs/common';
import {
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { parseAffiliateSubsJson } from '~/main/partners/affiliate-subs.util';
import { PrismaService } from '~/prisma/prisma.service';

import {
  KICK_PARTNER_CURRENCY,
  KICK_STREAM_RACE_BONUS_USD,
  KICK_STREAM_RACE_GOAL,
  KICK_STREAM_RACE_TYPE,
} from './kick-affiliate.constants';
import type { KickPartnerMeta } from './kick-partner.types';

@Injectable()
export class KickStreamRaceService {
  private readonly logger = new Logger(KickStreamRaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
  ) {}

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  async countSessionKickRegs(partnerUserId: number, sessionStartedAt: Date): Promise<number> {
    const referred = await this.prisma.user.findMany({
      where: {
        affiliatedById: partnerUserId,
        createdAt: { gte: sessionStartedAt },
      },
      select: { affiliateSubs: true },
    });

    return referred.filter((row) => {
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      return subs.sub1?.toLowerCase() === 'kick';
    }).length;
  }

  async getSessionRaceProgress(partnerUserId: number, kick: KickPartnerMeta) {
    const goal = KICK_STREAM_RACE_GOAL;
    const bonusUsd = KICK_STREAM_RACE_BONUS_USD;

    if (!kick.activeSessionId) {
      return { goal, current: 0, bonusUsd, granted: false, active: false };
    }

    const session = await this.prisma.kickPartnerSession.findFirst({
      where: { id: kick.activeSessionId, partnerUserId },
      select: { startedAt: true, streamRaceGrantedAt: true },
    });

    if (!session) {
      return { goal, current: 0, bonusUsd, granted: false, active: false };
    }

    const current = await this.countSessionKickRegs(partnerUserId, session.startedAt);
    return {
      goal,
      current,
      bonusUsd,
      granted: Boolean(session.streamRaceGrantedAt),
      active: true,
    };
  }

  async maybeGrantStreamRace(partnerUserId: number, sessionId: string): Promise<boolean> {
    const session = await this.prisma.kickPartnerSession.findFirst({
      where: { id: sessionId, partnerUserId, endedAt: null },
      select: { id: true, startedAt: true, streamRaceGrantedAt: true, kickChannel: true },
    });
    if (!session || session.streamRaceGrantedAt) return false;

    const kickRegs = await this.countSessionKickRegs(partnerUserId, session.startedAt);
    if (kickRegs < KICK_STREAM_RACE_GOAL) return false;

    const existing = await this.prisma.operation.findMany({
      where: {
        userId: partnerUserId,
        source: OperationSource.AFFILIATE,
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        currencyCode: KICK_PARTNER_CURRENCY,
        createdAt: { gte: session.startedAt },
      },
      select: { meta: true },
      take: 20,
    });

    const alreadyGranted = existing.some((op) => {
      const meta = (op.meta ?? {}) as Record<string, unknown>;
      return meta.bonusType === KICK_STREAM_RACE_TYPE && meta.sessionId === sessionId;
    });
    if (alreadyGranted) return false;

    await this.prisma.$transaction(async (tx) => {
      await this.operationService.create(tx, partnerUserId, {
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        source: OperationSource.AFFILIATE,
        amount: new Decimal(KICK_STREAM_RACE_BONUS_USD),
        currencyCode: KICK_PARTNER_CURRENCY,
        meta: {
          bonusType: KICK_STREAM_RACE_TYPE,
          reason: 'kick_stream_race',
          sessionId,
          kickRegistrations: kickRegs,
          channel: session.kickChannel,
        },
      });

      await tx.kickPartnerSession.update({
        where: { id: sessionId },
        data: { streamRaceGrantedAt: new Date() },
      });
    });

    this.logger.log(
      `Kick stream race $${KICK_STREAM_RACE_BONUS_USD} → partner ${partnerUserId} session ${sessionId} (${kickRegs} regs)`,
    );
    return true;
  }
}
