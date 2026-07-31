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

import { RaceService } from './race.service';

class PlaceRaceBetDto {
  @IsString()
  pairKey!: string;

  @IsIn(['A', 'B'])
  side!: 'A' | 'B';

  @IsNumber()
  @Min(1)
  stake!: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsNumber()
  roundMs?: number;
}

@Controller('casino/race')
export class RaceController {
  constructor(
    private readonly race: RaceService,
    private readonly auth: AuthenticationService,
  ) {}

  @Get('config')
  getConfig() {
    return this.race.getConfig();
  }

  @Get('state')
  async state(
    @Req() req: { headers?: Record<string, string>; cookies?: Record<string, string> },
    @Query('pairKey') pairKey?: string,
    @Query('roundMs') roundMs?: string,
  ) {
    const userId = await this.tryUserId(req);
    return this.race.getPublicState(
      userId,
      pairKey,
      roundMs != null ? Number(roundMs) : undefined,
    );
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets')
  myBets(
    @Req() req: { user: { id: number } },
    @Query('limit') limit?: string,
  ) {
    return this.race.getMyBets(req.user.id, Number(limit) || 20);
  }

  @UseGuards(AuthenticationGuard)
  @Post('bets')
  place(
    @Req() req: { user: { id: number } },
    @Body() body: PlaceRaceBetDto,
  ) {
    return this.race.placeBet({
      userId: req.user.id,
      pairKey: body.pairKey,
      side: body.side,
      stake: body.stake,
      currencyCode: body.currencyCode ?? 'KZT',
      roundMs: body.roundMs,
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
