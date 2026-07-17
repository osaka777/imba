import {
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
import type { Request, Response } from 'express';
import { WcOddsBetStatus, WcOddsPick } from '@prisma/client';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { SuperuserGuard } from '~/main/user/authentication/superuser.guard';

import { WcBroadcastProxyService } from './wc-broadcast-proxy.service';
import { WcOddsCashoutService } from './wc-odds-cashout.service';
import { WcOddsExpressService } from './wc-odds-express.service';
import { WcOddsBetService } from './wc-odds-bet.service';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import { WcOddsSyncService } from './wc-odds-sync.service';
import { parseRequestLocale } from '~/common/locale/parse-request-locale';
import type { OlimpbetApiLocale } from '~/common/locale/olimpbet-locale.util';

function resolveUiLocale(
  xLocale?: string,
  acceptLanguage?: string,
): OlimpbetApiLocale {
  return parseRequestLocale(xLocale, acceptLanguage) === 'en' ? 'en' : 'ru';
}

function resolveRequestHost(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-host'];
  const raw = typeof forwarded === 'string'
    ? forwarded.split(',')[0]
    : req.headers.host;
  return String(raw ?? 'imba.bet').trim();
}

import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';

class PlaceWcBetDto {
  eventId!: string;
  pick?: WcOddsPick;
  marketKey?: string;
  groupKey?: string;
  outcomeKey?: string;
  line?: string;
  outcomeName?: string;
  stake!: number;
  currencyCode?: string;
  clientOdds?: number;
  acceptOddsChange?: boolean;
}

class ExecuteWcCashoutDto {
  expectedAmount?: number;
}

class PlaceWcExpressLegDto {
  eventId!: string;
  pick?: WcOddsPick;
  marketKey?: string;
  groupKey?: string;
  outcomeKey?: string;
  line?: string;
  outcomeName?: string;
  clientOdds?: number;
}

class PlaceWcExpressBetDto {
  stake!: number;
  currencyCode?: string;
  acceptOddsChange?: boolean;
  legs!: PlaceWcExpressLegDto[];
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

  @Get('status')
  status() {
    return { enabled: this.olimpbet.isEnabled() };
  }

  @Get('home/widgets')
  homepageWidgets() {
    return this.betService.getHomepageWidgets();
  }

  @Get('line/counts')
  lineCounts() {
    return this.betService.listLineCountsBySport();
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
    return this.betService.listLineTournaments(sport, resolveUiLocale(xLocale, acceptLanguage));
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
      sport,
      date,
      hours,
      tournament,
      league,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      locale: resolveUiLocale(xLocale, acceptLanguage),
    });
  }

  @Get('search')
  searchEvents(@Query('q') q?: string, @Query('sport') sport?: string) {
    return this.betService.searchEvents(q ?? '', sport);
  }

  @Get('live/counts')
  liveCounts(@Query('broadcast') broadcast?: string) {
    return this.betService.listLiveCountsBySport(
      broadcast === '1' || broadcast === 'true',
    );
  }

  @Get('live/tournaments')
  liveTournaments(
    @Query('sport') sport?: string,
    @Headers('x-locale') xLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.betService.listLiveTournaments(sport, resolveUiLocale(xLocale, acceptLanguage));
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
      sport,
      tournament,
      league,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      broadcastOnly: broadcast === '1' || broadcast === 'true',
      locale: resolveUiLocale(xLocale, acceptLanguage),
    });
  }

  @Get('dates')
  dates() {
    return this.betService.listDates();
  }

  @Get('events')
  events(@Query('date') date?: string) {
    return this.betService.listEventsByDate(date);
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

  @Get('embed/h2h/:ref/sh')
  async h2hStatshubAsset(
    @Param('ref') ref: string,
    @Query('p') assetPath: string,
    @Res() res: Response,
  ) {
    await this.betService.proxyH2hStatshubAsset(ref, assetPath ?? '', res);
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

  @UseGuards(AuthenticationGuard)
  @Get('events/:ref/play')
  eventBroadcast(@Param('ref') ref: string, @Req() req: Request) {
    return this.betService.getEventBroadcast(ref, resolveRequestHost(req));
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
  @Get('events/:ref/view')
  broadcastEmbed(
    @Param('ref') ref: string,
    @Query('muted') muted: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.broadcastProxy.proxyEmbed(ref, res, resolveRequestHost(req), muted !== 'false');
  }

  @UseGuards(AuthenticationGuard)
  @Post('bets/express')
  placeExpressBet(
    @Req() req: { user: { id: number } },
    @Body() dto: PlaceWcExpressBetDto,
  ) {
    return this.expressService.placeExpressBet({
      userId: req.user.id,
      stake: Number(dto.stake),
      currencyCode: dto.currencyCode || 'KZT',
      acceptOddsChange: dto.acceptOddsChange === true,
      legs: dto.legs.map((leg) => ({
        eventId: leg.eventId,
        pick: leg.pick,
        marketKey: leg.marketKey,
        groupKey: leg.groupKey,
        outcomeKey: leg.outcomeKey,
        line: leg.line,
        outcomeName: leg.outcomeName,
        clientOdds: leg.clientOdds != null ? Number(leg.clientOdds) : undefined,
      })),
    });
  }

  @UseGuards(AuthenticationGuard)
  @Post('bets')
  placeBet(
    @Req() req: { user: { id: number } },
    @Headers('x-wc-probe-secret') probeSecret: string | undefined,
    @Body() dto: PlaceWcBetDto,
  ) {
    return this.betService.placeBet({
      userId: req.user.id,
      eventId: dto.eventId,
      pick: dto.pick,
      marketKey: dto.marketKey,
      groupKey: dto.groupKey,
      outcomeKey: dto.outcomeKey,
      line: dto.line,
      outcomeName: dto.outcomeName,
      stake: Number(dto.stake),
      currencyCode: dto.currencyCode || 'KZT',
      clientOdds: dto.clientOdds != null ? Number(dto.clientOdds) : undefined,
      acceptOddsChange: dto.acceptOddsChange === true,
      isProbe: this.betService.isProbePlacement(probeSecret),
    });
  }

  @UseGuards(AuthenticationGuard)
  @Get('my-tournament')
  myTournament(@Req() req: { user: { id: number } }) {
    return this.betService.getMyTournament(req.user.id);
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/:id/share')
  betShare(@Req() req: { user: { id: number } }, @Param('id') id: string) {
    return this.betService.getBetShare(req.user.id, Number(id));
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/my')
  myBets(@Req() req: { user: { id: number } }) {
    return this.betService.listUserBets(req.user.id);
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/cashout-quotes')
  cashoutQuotes(
    @Req() req: { user: { id: number } },
    @Query('ids') ids?: string,
  ) {
    const betIds = ids
      ? ids.split(",").map((id) => Number(id.trim())).filter((id) => Number.isFinite(id) && id > 0)
      : undefined;
    return this.cashoutService.getCashoutQuotesForUser(req.user.id, betIds);
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets/:id/cashout-quote')
  cashoutQuote(@Req() req: { user: { id: number } }, @Param('id') id: string) {
    return this.cashoutService.getCashoutQuote(req.user.id, Number(id));
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
    return this.betService.getUserBet(req.user.id, Number(id));
  }

  @UseGuards(AuthenticationGuard)
  @Get('events/:ref/subscription')
  eventSubscription(
    @Req() req: { user: { id: number } },
    @Param('ref') ref: string,
  ) {
    return this.betService.getEventSubscription(req.user.id, ref);
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

  @UseGuards(SuperuserGuard)
  @Get('admin/bets')
  adminBets(@Query('status') status?: WcOddsBetStatus) {
    return this.betService.listAllBets(status);
  }

  @UseGuards(SuperuserGuard)
  @Get('admin/bets/health')
  adminBetHealth(@Query('hours') hours?: string) {
    const parsed = Number(hours);
    return this.betService.getAdminBetHealthStats(
      Number.isFinite(parsed) && parsed > 0 ? parsed : 24,
    );
  }

  @UseGuards(SuperuserGuard)
  @Post('admin/sync')
  adminSync() {
    return this.syncService.syncOdds();
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
  @Post('admin/repair/event/:eventId')
  adminRepairEvent(@Param('eventId') eventId: string) {
    return this.settlementService.repairEventSettledBets(eventId);
  }
}
