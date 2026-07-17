import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { AuthenticationService } from '~/main/user/authentication/authentication.service';

import { BtcUpdownService } from './btc-updown.service';

class PlaceBtcUpdownBetDto {
  @IsIn(['UP', 'DOWN'])
  side!: 'UP' | 'DOWN';

  @IsNumber()
  @Min(1)
  stake!: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsNumber()
  roundMs?: number;

  @IsOptional()
  @IsNumber()
  expectedPrice?: number;
}

@Controller('casino/btc-updown')
export class BtcUpdownController {
  constructor(
    private readonly btc: BtcUpdownService,
    private readonly auth: AuthenticationService,
  ) {}

  @Get('config')
  getConfig() {
    return this.btc.getConfig();
  }

  @Get('quote')
  getQuote(
    @Query('symbol') symbol?: string,
    @Query('roundMs') roundMs?: string,
  ) {
    return this.btc.getQuote(
      symbol,
      roundMs != null ? Number(roundMs) : undefined,
    );
  }

  @Get('state')
  async state(
    @Req() req: { headers?: Record<string, string>; cookies?: Record<string, string> },
    @Query('symbol') symbol?: string,
    @Query('roundMs') roundMs?: string,
  ) {
    const userId = await this.tryUserId(req);
    return this.btc.getPublicState(
      userId,
      symbol,
      roundMs != null ? Number(roundMs) : undefined,
    );
  }

  @UseGuards(AuthenticationGuard)
  @Get('stats/daily')
  dailyStats(
    @Req() req: { user: { id: number } },
    @Query('currencyCode') currencyCode?: string,
  ) {
    return this.btc.getDailyStats(req.user.id, currencyCode ?? 'KZT');
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets')
  myBets(
    @Req() req: { user: { id: number } },
    @Query('limit') limit?: string,
  ) {
    return this.btc.getMyBets(req.user.id, Number(limit) || 20);
  }

  @UseGuards(AuthenticationGuard)
  @Post('bets')
  place(
    @Req() req: { user: { id: number } },
    @Body() body: PlaceBtcUpdownBetDto,
  ) {
    return this.btc.placeBet({
      userId: req.user.id,
      side: body.side,
      stake: body.stake,
      currencyCode: body.currencyCode ?? 'KZT',
      symbol: body.symbol,
      roundMs: body.roundMs,
      expectedPrice: body.expectedPrice,
    });
  }

  private async tryUserId(req: {
    headers?: Record<string, string | undefined>;
    cookies?: Record<string, string | undefined>;
  }): Promise<number | undefined> {
    try {
      const cookieToken =
        req.cookies?.['accessToken'] || req.cookies?.['access_token'];
      const auth = req.headers?.['authorization'];
      const bearer =
        typeof auth === 'string' && auth.startsWith('Bearer ')
          ? auth.slice(7)
          : undefined;
      const token = cookieToken || bearer;
      if (!token) return undefined;
      const user = await this.auth.verify(token);
      const id = Number(user?.id);
      return Number.isFinite(id) ? id : undefined;
    } catch {
      return undefined;
    }
  }
}
