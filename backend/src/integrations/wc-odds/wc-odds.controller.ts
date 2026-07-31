import type { Request, Response } from 'express';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { WcOddsBetStatus, WcOddsPick } from '@prisma/client';

import type { OlimpbetApiLocale } from '~/common/locale/olimpbet-locale.util';

import { parseRequestLocale } from '~/common/locale/parse-request-locale';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { SuperuserGuard } from '~/main/user/authentication/superuser.guard';

import { WcBroadcastProxyService } from './wc-broadcast-proxy.service';
import { WcOddsBetService } from './wc-odds-bet.service';
import { WcOddsCashoutService } from './wc-odds-cashout.service';
import { WcOddsExpressService } from './wc-odds-express.service';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import { WcOddsSyncService } from './wc-odds-sync.service';

function resolveUiLocale(
  xLocale?: string,
  acceptLanguage?: string,
): OlimpbetApiLocale {
  return parseRequestLocale(xLocale, acceptLanguage) === 'en' ? 'en' : 'ru';
}

function resolveRequestHost(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = req.headers['x-forwarded-host'];
  const raw =
    typeof forwarded === 'string' ? forwarded.split(',')[0] : req.headers.host;
  return String(raw ?? 'imba.bet').trim();
}

import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';

class PlaceWcBetDto {
  acceptOddsChange?: boolean;
  accountType?: 'bonus' | 'main';
  clientOdds?: number;
  currencyCode?: string;
  eventId!: string;
  groupKey?: string;
  line?: string;
  marketKey?: string;
  outcomeKey?: string;
  outcomeName?: string;
  pick?: WcOddsPick;
  stake!: number;
}

class ExecuteWcCashoutDto {
  expectedAmount?: number;
}

class PlaceWcExpressLegDto {
  clientOdds?: number;
  eventId!: string;
  groupKey?: string;
  line?: string;
  marketKey?: string;
  outcomeKey?: string;
  outcomeName?: string;
  pick?: WcOddsPick;
}

class PlaceWcExpressBetDto {
  acceptOddsChange?: boolean;
  accountType?: 'bonus' | 'main';
  currencyCode?: string;
  legs!: PlaceWcExpressLegDto[];
  stake!: number;
}

@Controller('feed')
export class WcOddsController {
  constructor(
    private readonly betService: WcOddsBetService,
    private readonly syncService: WcOddsSyncService,
    private readonly settlementService: WcOddsSettlementService,
    private readonly cashoutService: WcOddsCashoutService,
    private readonly expressService: WcOddsExpressService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly broadcastProxy: WcBroadcastProxyService,
  ) {}

  @UseGuards(SuperuserGuard)
  @Get('admin/bets/health')
  adminBetHealth(@Query('hours') hours?: string) {
    const parsed = Number(hours);
    return this.betService.getAdminBetHealthStats(
      Number.isFinite(parsed) && parsed > 0 ? parsed : 24,
    );
  }

  @UseGuards(SuperuserGuard)
  @Get('admin/bets')
  adminBets(@Query('status') status?: WcOddsBetStatus) {
    return this.betService.listAllBets(status);
  }

  @UseGuards(SuperuserGuard)
  @Post('admin/repair/event/:eventId')
  adminRepairEvent(@Param('eventId') eventId: string) {
    return this.settlementService.repairEventSettledBets(eventId);
  }

  @UseGuards(SuperuserGuard)
  @Post('admin/settle')
  adminSettle() {
    return this.settlementService.settleFinishedEvents();
  }

  @UseGuards(SuperuserGuard)
  @Post('admin/settle/bet/:id')
  adminSettleBet(@Param('id') id: string) {
    return this.settlementService.tryRecalcPendingBet(Number(id));
  }

  @UseGuards(SuperuserGuard)
  @Post('admin/sync')
  adminSync() {
    return this.syncService.syncOdds();
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/:id/share')
  betShare(@Req() req: { user: { id: number } }, @Param('id') id: string) {
    return this.betService.getBetShare(req.user.id, Number(id));
  }

  @UseGuards(AuthenticationGuard)
  @Get('events/:ref/view')
  broadcastEmbed(
    @Param('ref') ref: string,
    @Query('muted') muted: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.broadcastProxy.proxyEmbed(
      ref,
      res,
      resolveRequestHost(req),
      muted !== 'false',
    );
  }

  @UseGuards(AuthenticationGuard)
  @Get('events/:ref/v')
  broadcastManifest(@Param('ref') ref: string, @Res() res: Response) {
    return this.broadcastProxy.proxyManifest(ref, res);
  }

  @UseGuards(AuthenticationGuard)
  @Get('events/:ref/s')
  broadcastSegment(
    @Param('ref') ref: string,
    @Query('src') src: string,
    @Res() res: Response,
  ) {
    return this.broadcastProxy.proxyHls(ref, src ?? '', res);
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/:id/cashout-quote')
  cashoutQuote(@Req() req: { user: { id: number } }, @Param('id') id: string) {
    return this.cashoutService.getCashoutQuote(req.user.id, Number(id));
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/cashout-quotes')
  cashoutQuotes(
    @Req() req: { user: { id: number } },
    @Query('ids') ids?: string,
  ) {
    const betIds = ids
      ? ids
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isFinite(id) && id > 0)
      : undefined;
    return this.cashoutService.getCashoutQuotesForUser(req.user.id, betIds);
  }

  @Get('dates')
  dates() {
    return this.betService.listDates();
  }

  @UseGuards(AuthenticationGuard)
  @Get('events/:ref/play')
  eventBroadcast(@Param('ref') ref: string, @Req() req: Request) {
    return this.betService.getEventBroadcast(ref, resolveRequestHost(req));
  }

  @Get('events/:ref')
  async eventDetail(
    @Param('ref') ref: string,
    @Query('sync') sync?: string,
    @Headers('x-locale') xLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const forceSync = sync === '1' || sync === 'true';
    const detail = await this.betService.getEventDetail(
      ref,
      resolveUiLocale(xLocale, acceptLanguage),
      { sync: forceSync },
    );
    const { syncOk, ...payload } = detail;
    if (forceSync && res) {
      res.setHeader('X-WC-Synced', syncOk === false ? '0' : '1');
      res.setHeader('Cache-Control', 'no-store');
    }
    return payload;
  }

  /**
   * Public — the Live Tracker is a supplementary stats widget (same tier as
   * the already-public `statList` on `/events/:ref`), unlike the video
   * broadcast endpoints which are gated behind login.
   */
  @Get('events/:ref/tracker')
  eventLiveTracker(@Param('ref') ref: string) {
    return this.betService.getLiveTracker(ref);
  }

  @UseGuards(AuthenticationGuard)
  @Get('events/:ref/subscription')
  eventSubscription(
    @Req() req: { user: { id: number } },
    @Param('ref') ref: string,
  ) {
    return this.betService.getEventSubscription(req.user.id, ref);
  }

  @Get('events')
  events(
    @Query('date') date?: string,
    @Query('phase') phase?: string,
    @Query('sport') sport?: string,
    @Query('hours') hours?: string,
    @Query('tournament') tournament?: string,
    @Query('league') league?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-locale') xLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = resolveUiLocale(xLocale, acceptLanguage);
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset, 10) : undefined;

    // Backward-compatible bridge for older clients. Existing no-query/date-only
    // requests keep their full legacy response; explicit filters use the
    // paginated live/line implementations instead of serializing the catalog.
    if (phase?.toLowerCase() === 'live') {
      return this.betService.listLiveEvents({
        league,
        limit: parsedLimit,
        locale,
        offset: parsedOffset,
        sport,
        tournament,
      });
    }
    if (
      phase?.toLowerCase() === 'prematch' ||
      sport ||
      hours ||
      tournament ||
      league ||
      limit ||
      offset
    ) {
      return this.betService.listLineEvents({
        date,
        hours,
        league,
        limit: parsedLimit,
        locale,
        offset: parsedOffset,
        sport,
        tournament,
      });
    }
    return this.betService.listEventsByDate(date);
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/my')
  myBets(@Req() req: { user: { id: number } }) {
    return this.betService.listUserBets(req.user.id);
  }

  @UseGuards(AuthenticationGuard)
  @Post('bets/:id/cashout')
  executeCashout(
    @Req() req: { user: { id: number } },
    @Param('id') id: string,
    @Body() dto: ExecuteWcCashoutDto,
  ) {
    return this.cashoutService.executeCashout(
      req.user.id,
      Number(id),
      dto.expectedAmount != null ? Number(dto.expectedAmount) : undefined,
    );
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/:id')
  getBet(@Req() req: { user: { id: number } }, @Param('id') id: string) {
    const betId = Number(id);
    if (!Number.isFinite(betId) || betId <= 0) {
      throw new BadRequestException('Invalid bet id');
    }
    return this.betService.getUserBet(req.user.id, betId);
  }

  @Get('embed/h2h/:ref')
  async h2hEmbed(@Param('ref') ref: string, @Res() res: Response) {
    const html = await this.betService.getH2hEmbedHtmlAsync(ref);
    if (!html) {
      throw new NotFoundException('H2H not available for this event');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  }

  @Get('embed/h2h/:ref/sh')
  async h2hStatshubAsset(
    @Param('ref') ref: string,
    @Query('p') assetPath: string,
    @Res() res: Response,
  ) {
    await this.betService.proxyH2hStatshubAsset(ref, assetPath ?? '', res);
  }

  @Get('home/widgets')
  homepageWidgets() {
    return this.betService.getHomepageWidgets();
  }

  @Get('line/counts')
  lineCounts() {
    return this.betService.listLineCountsBySport();
  }

  @Get('line/events')
  lineEvents(
    @Query('sport') sport?: string,
    @Query('date') date?: string,
    @Query('hours') hours?: string,
    @Query('tournament') tournament?: string,
    @Query('league') league?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-locale') xLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.betService.listLineEvents({
      date,
      hours,
      league,
      limit: limit ? parseInt(limit, 10) : undefined,
      locale: resolveUiLocale(xLocale, acceptLanguage),
      offset: offset ? parseInt(offset, 10) : undefined,
      sport,
      tournament,
    });
  }

  @Get('line/time-counts')
  lineTimeCounts(@Query('sport') sport?: string) {
    return this.betService.listLineTimeCounts(sport);
  }

  @Get('line/tournaments')
  lineTournaments(
    @Query('sport') sport?: string,
    @Headers('x-locale') xLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.betService.listLineTournaments(
      sport,
      resolveUiLocale(xLocale, acceptLanguage),
    );
  }

  @Get('live/counts')
  liveCounts(@Query('broadcast') broadcast?: string) {
    return this.betService.listLiveCountsBySport(
      broadcast === '1' || broadcast === 'true',
    );
  }

  @Get('live/events')
  liveEvents(
    @Query('sport') sport?: string,
    @Query('tournament') tournament?: string,
    @Query('league') league?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('broadcast') broadcast?: string,
    @Headers('x-locale') xLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.betService.listLiveEvents({
      broadcastOnly: broadcast === '1' || broadcast === 'true',
      league,
      limit: limit ? parseInt(limit, 10) : undefined,
      locale: resolveUiLocale(xLocale, acceptLanguage),
      offset: offset ? parseInt(offset, 10) : undefined,
      sport,
      tournament,
    });
  }

  @Get('live/tournaments')
  liveTournaments(
    @Query('sport') sport?: string,
    @Headers('x-locale') xLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.betService.listLiveTournaments(
      sport,
      resolveUiLocale(xLocale, acceptLanguage),
    );
  }

  @UseGuards(AuthenticationGuard)
  @Get('my-tournament')
  myTournament(@Req() req: { user: { id: number } }) {
    return this.betService.getMyTournament(req.user.id);
  }

  @UseGuards(AuthenticationGuard)
  @Post('bets')
  placeBet(
    @Req() req: { user: { id: number } },
    @Headers('x-wc-probe-secret') probeSecret: string | undefined,
    @Body() dto: PlaceWcBetDto,
  ) {
    return this.betService.placeBet({
      acceptOddsChange: dto.acceptOddsChange === true,
      accountType: dto.accountType === 'bonus' ? 'bonus' : 'main',
      clientOdds: dto.clientOdds != null ? Number(dto.clientOdds) : undefined,
      currencyCode: dto.currencyCode || 'KZT',
      eventId: dto.eventId,
      groupKey: dto.groupKey,
      isProbe: this.betService.isProbePlacement(probeSecret),
      line: dto.line,
      marketKey: dto.marketKey,
      outcomeKey: dto.outcomeKey,
      outcomeName: dto.outcomeName,
      pick: dto.pick,
      stake: Number(dto.stake),
      userId: req.user.id,
    });
  }

  @UseGuards(AuthenticationGuard)
  @Post('bets/express')
  placeExpressBet(
    @Req() req: { user: { id: number } },
    @Body() dto: PlaceWcExpressBetDto,
  ) {
    if (dto.accountType === 'bonus') {
      throw new BadRequestException(
        'С бонусного счёта экспресс недоступен — только ординар',
      );
    }
    return this.expressService.placeExpressBet({
      acceptOddsChange: dto.acceptOddsChange === true,
      currencyCode: dto.currencyCode || 'KZT',
      legs: dto.legs.map((leg) => ({
        clientOdds: leg.clientOdds != null ? Number(leg.clientOdds) : undefined,
        eventId: leg.eventId,
        groupKey: leg.groupKey,
        line: leg.line,
        marketKey: leg.marketKey,
        outcomeKey: leg.outcomeKey,
        outcomeName: leg.outcomeName,
        pick: leg.pick,
      })),
      stake: Number(dto.stake),
      userId: req.user.id,
    });
  }

  @Get('search')
  searchEvents(@Query('q') q?: string, @Query('sport') sport?: string) {
    return this.betService.searchEvents(q ?? '', sport);
  }

  @Get('status')
  status() {
    return { enabled: this.olimpbet.isEnabled() };
  }

  @UseGuards(AuthenticationGuard)
  @Post('events/:ref/subscribe')
  subscribeEvent(
    @Req() req: { user: { id: number } },
    @Param('ref') ref: string,
    @Body() body: { notifyGoals?: boolean; notifyStart?: boolean },
  ) {
    return this.betService.subscribeEvent(req.user.id, ref, body);
  }

  @UseGuards(AuthenticationGuard)
  @Delete('events/:ref/subscribe')
  unsubscribeEvent(
    @Req() req: { user: { id: number } },
    @Param('ref') ref: string,
  ) {
    return this.betService.unsubscribeEvent(req.user.id, ref);
  }
}
