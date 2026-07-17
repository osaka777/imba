import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { PartnerGuard } from '~/main/partners/authentication/partner.guard';

import { KickDevService } from './kick-dev.service';
import { KickPartnerService } from './kick-partner.service';
import { KickWidgetAlertService } from './kick-widget-alert.service';
import { KickWebhookService } from './kick-webhook.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('kick')
export class KickDevController {
  constructor(
    private readonly kickDev: KickDevService,
    private readonly kickPartner: KickPartnerService,
    private readonly kickWebhook: KickWebhookService,
    private readonly kickWidgetAlerts: KickWidgetAlertService,
  ) {}

  @Get('dev/status')
  status() {
    return this.kickDev.getPublicStatus();
  }

  @Get('dev/check-token')
  checkToken() {
    return this.kickDev.checkAppToken();
  }

  @Get('partners/live')
  livePartners() {
    return this.kickPartner.getLivePartners();
  }

  @Get('partners/stats')
  publicStats() {
    return this.kickPartner.getPublicKickStats();
  }

  @Get('partners/scoreboard')
  publicScoreboard() {
    return this.kickPartner.getPublicScoreboard();
  }

  @Get('partners/by-tag/:tag')
  partnerByTag(@Param('tag') tag: string) {
    return this.kickPartner.getPartnerByTag(tag);
  }

  @Get('partners/widget/:tag')
  partnerWidget(@Param('tag') tag: string) {
    return this.kickPartner.getPartnerByTag(tag);
  }

  @Get('click/:slug')
  clickLanding(@Param('slug') slug: string) {
    return this.kickPartner.getClickLandingData(slug);
  }

  @Get('r/:slug')
  async shortRedirect(@Param('slug') slug: string, @Res() res: Response) {
    const url = await this.kickPartner.handleShortRedirect(slug);
    if (!url) {
      return res.status(404).send('Partner link not found');
    }
    return res.redirect(302, url);
  }

  @Get('partners/widget/:tag/alerts')
  partnerWidgetAlerts(
    @Param('tag') tag: string,
    @Query('after') after?: string,
  ) {
    return this.kickWidgetAlerts.getAlertsByTag(tag, after?.trim() || null);
  }

  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.kickPartner.completeOAuth({ code, state, error });
    return res.redirect(result.redirectTo);
  }

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
    return this.kickWebhook.handleWebhook({
      headers,
      rawBody,
      parsedBody: body,
    });
  }
}

@Controller('affiliate-program/user/kick')
@UseGuards(PartnerGuard)
export class KickPartnerController {
  constructor(private readonly kickPartner: KickPartnerService) {}

  @Get('status')
  status(@Req() req: { user: { id: number } }) {
    return this.kickPartner.getStatus(req.user.id);
  }

  @Get('session-live')
  sessionLive(@Req() req: { user: { id: number } }) {
    return this.kickPartner.getSessionLiveStats(req.user.id);
  }

  @Get('connect')
  connect(@Req() req: { user: { id: number } }) {
    return this.kickPartner.startConnect(req.user.id);
  }

  @Get('analytics')
  analytics(
    @Req() req: { user: { id: number } },
    @Query('currency') currency?: string,
  ) {
    return this.kickPartner.getKickAnalytics(req.user.id, currency?.trim() || 'USD');
  }

  @Patch('onboarding')
  updateOnboarding(
    @Req() req: { user: { id: number } },
    @Body() body: { linkDone?: boolean; obsDone?: boolean },
  ) {
    return this.kickPartner.updateOnboardingChecklist(req.user.id, body);
  }

  @Get('sessions')
  sessions(
    @Req() req: { user: { id: number } },
    @Query('limit') limit?: string,
  ) {
    const parsed = Number(limit);
    return this.kickPartner.getPartnerSessions(
      req.user.id,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 20,
    );
  }

  @Post('disconnect')
  disconnect(@Req() req: { user: { id: number } }) {
    return this.kickPartner.disconnect(req.user.id);
  }

  @Post('resubscribe')
  resubscribe(@Req() req: { user: { id: number } }) {
    return this.kickPartner.resubscribeWebhooks(req.user.id);
  }
}
