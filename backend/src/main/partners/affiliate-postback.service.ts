import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AffiliatePostbackEvent, AffiliatePostbackStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

import { PrismaService } from '~/prisma/prisma.service';

import { subsToPostbackParams } from './affiliate-subs.util';

export type PostbackEvent =
  | 'registration'
  | 'ftd'
  | 'commission'
  | 'promo_redeemed';

export type PostbackPayload = {
  event: PostbackEvent;
  partnerUid: string;
  partnerId: number;
  playerId: number;
  playerEmail?: string;
  amount?: string;
  currency?: string;
  betId?: number;
  promoCode?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

@Injectable()
export class AffiliatePostbackService {
  private readonly logger = new Logger(AffiliatePostbackService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
  ) {}

  async send(
    postbackUrl: string | undefined | null,
    payload: PostbackPayload,
  ): Promise<void> {
    if (!postbackUrl?.trim()) return;

    const url = this.buildUrl(postbackUrl.trim(), payload);
    const log = await this.prismaService.affiliatePostbackLog.create({
      data: {
        partnerUserId: payload.partnerId,
        playerId: payload.playerId,
        event: payload.event as AffiliatePostbackEvent,
        url,
        payload: payload as object,
        status: AffiliatePostbackStatus.PENDING,
        attempt: 0,
      },
    });

    void this.deliverWithRetry(log.id, url, payload);
  }

  async sendTest(
    partnerUserId: number,
    postbackUrl: string,
    partnerUid: string,
  ): Promise<{ success: boolean; httpStatus?: number; error?: string }> {
    const payload: PostbackPayload = {
      event: 'registration',
      partnerUid,
      partnerId: partnerUserId,
      playerId: 0,
      playerEmail: 'test@example.com',
    };

    const url = this.buildUrl(postbackUrl.trim(), payload);
    const log = await this.prismaService.affiliatePostbackLog.create({
      data: {
        partnerUserId,
        playerId: null,
        event: AffiliatePostbackEvent.registration,
        url,
        payload: { ...payload, test: true } as object,
        status: AffiliatePostbackStatus.PENDING,
        attempt: 0,
      },
    });

    return this.deliverWithRetry(log.id, url, payload);
  }

  private async deliverWithRetry(
    logId: number,
    url: string,
    payload: PostbackPayload,
  ): Promise<{ success: boolean; httpStatus?: number; error?: string }> {
    let lastError: string | undefined;
    let lastStatus: number | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(url, {
            timeout: 8000,
            validateStatus: () => true,
            responseType: 'text',
          }),
        );

        lastStatus = response.status;
        const responseBody =
          typeof response.data === 'string'
            ? response.data.slice(0, 500)
            : JSON.stringify(response.data).slice(0, 500);

        const success = response.status >= 200 && response.status < 400;

        await this.prismaService.affiliatePostbackLog.update({
          where: { id: logId },
          data: {
            attempt,
            httpStatus: response.status,
            responseBody,
            status: success
              ? AffiliatePostbackStatus.SUCCESS
              : AffiliatePostbackStatus.FAILED,
          },
        });

        if (success) {
          this.logger.log(
            `Postback sent: ${payload.event} player=${payload.playerId} partner=${payload.partnerId}`,
          );
          return { success: true, httpStatus: response.status };
        }

        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await this.prismaService.affiliatePostbackLog.update({
          where: { id: logId },
          data: {
            attempt,
            status: AffiliatePostbackStatus.FAILED,
            responseBody: lastError.slice(0, 500),
          },
        });
      }

      if (attempt < MAX_ATTEMPTS) {
        await this.sleep(RETRY_DELAY_MS * attempt);
      }
    }

    this.logger.warn(
      `Postback failed after ${MAX_ATTEMPTS} attempts: ${payload.event} player=${payload.playerId} — ${lastError}`,
    );

    return { success: false, httpStatus: lastStatus, error: lastError };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildUrl(baseUrl: string, payload: PostbackPayload): string {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams({
      event: payload.event,
      partner_id: String(payload.partnerId),
      partner_uid: payload.partnerUid,
      player_id: String(payload.playerId),
    });

    if (payload.playerEmail) {
      params.set('player_email', payload.playerEmail);
    }
    if (payload.amount) {
      params.set('amount', payload.amount);
    }
    if (payload.currency) {
      params.set('currency', payload.currency);
    }
    if (payload.betId != null) {
      params.set('bet_id', String(payload.betId));
    }
    if (payload.promoCode) {
      params.set('promo_code', payload.promoCode);
    }
    for (const [key, value] of Object.entries(subsToPostbackParams({
      sub1: payload.sub1,
      sub2: payload.sub2,
      sub3: payload.sub3,
      sub4: payload.sub4,
      sub5: payload.sub5,
    }))) {
      params.set(key, value);
    }

    return `${baseUrl}${separator}${params.toString()}`;
  }
}
