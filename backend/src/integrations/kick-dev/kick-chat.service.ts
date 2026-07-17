import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WcOddsBetService } from '~/integrations/wc-odds/wc-odds-bet.service';

import type { KickPartnerMeta } from './kick-partner.types';
import { KickChatRateLimitService } from './kick-chat-rate-limit.service';
import { KickGuessContestService } from './kick-guess-contest.service';
import { buildKickShortClickUrl, normalizeKickShortClickDomain } from './kick-short-url.util';
import { findFeaturedLiveMatch } from './kick-live-match.util';
import { KickTokenService } from './kick-token.service';
import {
  isLikelyBotReply,
  parseKickChatCommand,
  parseScoreGuess,
  type KickChatCommand,
} from './kick-chat.util';

type ChatMessagePayload = {
  message_id?: string;
  content?: string;
  broadcaster?: {
    user_id?: number;
    channel_slug?: string;
    username?: string;
  };
  sender?: {
    user_id?: number;
    username?: string;
  };
};

type PartnerContext = {
  userId: number;
  uid: string;
  kick: KickPartnerMeta;
  promoCode?: string | null;
};

@Injectable()
export class KickChatService {
  private readonly logger = new Logger(KickChatService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly kickToken: KickTokenService,
    private readonly rateLimit: KickChatRateLimitService,
    private readonly wcOddsBet: WcOddsBetService,
    private readonly guessContest: KickGuessContestService,
  ) {}

  private buildShortUrl(channelSlug?: string | null) {
    const domain = normalizeKickShortClickDomain(
      this.config.get<string>('KICK_SHORT_CLICK_DOMAIN'),
    );
    return buildKickShortClickUrl(channelSlug, domain);
  }

  private buildPartnerBetUrl(partnerUid: string, channelSlug?: string | null) {
    const affiliateBase = (
      this.config.get<string>('AFFILIATE_BASE_URL')?.trim() || 'https://imba.bet/'
    ).replace(/\/?$/, '/');

    const url = new URL(affiliateBase);
    url.searchParams.set('tag', partnerUid);
    url.searchParams.set('sub1', 'kick');
    url.searchParams.set('sub2', channelSlug || 'chat');
    return url.toString();
  }

  private buildMatchUrl(partnerUid: string, channelSlug: string | null, eventId: string) {
    const url = new URL(`https://imba.bet/cybersport/game/${encodeURIComponent(eventId)}`);
    url.searchParams.set('tag', partnerUid);
    url.searchParams.set('sub1', 'kick');
    url.searchParams.set('sub2', channelSlug || 'chat');
    return url.toString();
  }

  buildLiveWelcomeMessage(partner: PartnerContext) {
    const slug = partner.kick.channelSlug || 'chat';
    const shortUrl = this.buildShortUrl(slug);
    const promo = partner.promoCode?.trim();
    if (shortUrl && promo) {
      return `Эфир на imba → ${shortUrl} | Промо: ${promo}`;
    }
    if (shortUrl) {
      return `Ставки в эфире → ${shortUrl}`;
    }
    return `Ставки на imba.bet → ${this.buildPartnerBetUrl(partner.uid, slug)}`;
  }

  private async buildReply(command: KickChatCommand, partner: PartnerContext) {
    const slug = partner.kick.channelSlug || 'chat';
    const shortUrl = this.buildShortUrl(slug);

    if (command === 'imba') {
      const promo = partner.promoCode?.trim();
      if (shortUrl && promo) {
        return `Ставки на imba → ${shortUrl} | Промо: ${promo}`;
      }
      if (shortUrl) {
        return `Ставки на imba → ${shortUrl}`;
      }
      return `Ставки на imba.bet → ${this.buildPartnerBetUrl(partner.uid, slug)}`;
    }

    if (command === 'promo') {
      const promo = partner.promoCode?.trim();
      if (promo) {
        return `Промокод imba.bet: ${promo}`;
      }
      if (shortUrl) {
        return `Промокод не настроен. Регистрация → ${shortUrl}`;
      }
      return `Промокод не настроен. Регистрация → ${this.buildPartnerBetUrl(partner.uid, slug)}`;
    }

    if (command === 'score' || command === 'match') {
      try {
        const featured = await findFeaturedLiveMatch(this.wcOddsBet);
        if (featured) {
          const score =
            featured.homeScore != null && featured.awayScore != null
              ? ` ${featured.homeScore}:${featured.awayScore}`
              : '';
          const matchUrl = this.buildMatchUrl(partner.uid, slug, featured.id);
          const teams = `${featured.homeTeam} vs ${featured.awayTeam}`;
          const sportTag = featured.sport === 'dota2' ? 'Dota' : 'CS';
          if (command === 'score') {
            return `🔴 ${sportTag} ${teams}${score} | Угадай: !счёт 2-1 → ${matchUrl}`;
          }
          return `🔴 LIVE ${teams}${score} → ${matchUrl}`;
        }
      } catch (error) {
        this.logger.warn(
          `Kick !match live lookup failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      const fallback = new URL('https://imba.bet/cybersport/live');
      fallback.searchParams.set('tag', partner.uid);
      fallback.searchParams.set('sub1', 'kick');
      fallback.searchParams.set('sub2', slug);
      return command === 'score'
        ? `Live на imba — угадай счёт: !счёт 2-1 | ${fallback.toString()}`
        : `Live CS/Dota на imba → ${fallback.toString()}`;
    }

    return `Ставки на imba.bet → ${this.buildPartnerBetUrl(partner.uid, slug)}`;
  }

  private async canReply(channelSlug: string, senderUserId: number) {
    return this.rateLimit.canReply(channelSlug, senderUserId);
  }

  async sendBotMessage(accessToken: string, content: string) {
    const res = await fetch('https://api.kick.com/public/v1/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bot',
        content: content.slice(0, 500),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Kick chat post failed: ${res.status} ${text.slice(0, 200)}`);
    }

    return res.json();
  }

  async handleChatMessage(partner: PartnerContext, payload: ChatMessagePayload) {
    const content = payload.content?.trim();
    if (!content || isLikelyBotReply(content)) {
      return { handled: false, reason: 'ignored_content' };
    }

    const accessToken = await this.kickToken.getValidAccessToken(partner.userId);
    const channelSlug = payload.broadcaster?.channel_slug || partner.kick.channelSlug;
    const senderUserId = payload.sender?.user_id;
    const senderUsername = payload.sender?.username ?? 'viewer';
    if (!accessToken || !channelSlug || senderUserId == null) {
      return { handled: false, reason: 'missing_context' };
    }

    const scoreGuess = parseScoreGuess(content);
    if (scoreGuess) {
      if (!(await this.canReply(channelSlug, senderUserId))) {
        return { handled: true, action: 'rate_limited', command: 'score_guess' };
      }
      const result = await this.guessContest.recordGuess(
        partner.userId,
        senderUserId,
        senderUsername,
        scoreGuess.home,
        scoreGuess.away,
      );
      try {
        await this.sendBotMessage(accessToken, result.reply);
        return {
          handled: true,
          action: result.ok ? 'guess_recorded' : 'guess_rejected',
          command: 'score_guess',
          partnerUserId: partner.userId,
        };
      } catch (error) {
        this.logger.warn(
          `Kick score guess reply failed for partner ${partner.userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return { handled: true, action: 'send_failed', command: 'score_guess' };
      }
    }

    const command = parseKickChatCommand(content);
    if (!command) {
      return { handled: false, reason: 'no_command' };
    }

    if (!(await this.canReply(channelSlug, senderUserId))) {
      return { handled: true, action: 'rate_limited', command };
    }

    const reply = await this.buildReply(command, partner);
    try {
      await this.sendBotMessage(accessToken, reply);
      return {
        handled: true,
        action: 'replied',
        command,
        partnerUserId: partner.userId,
      };
    } catch (error) {
      this.logger.warn(
        `Kick chat reply failed for partner ${partner.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { handled: true, action: 'send_failed', command };
    }
  }
}
