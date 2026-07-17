import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';

import { SnakeService } from './snake.service';

class PlaceSnakeRoundDto {
  @IsNumber()
  @Min(1)
  stake!: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}

class SettleSnakeRoundDto {
  @IsNumber()
  @Min(3)
  @Max(5000)
  length!: number;

  @IsNumber()
  @Min(0)
  @Max(500)
  kills!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15 * 60_000)
  boostMs?: number;
}

class HeartbeatDto {
  @IsBoolean()
  boosting!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(5000)
  length?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  kills?: number;
}

@Controller('casino/snake')
export class SnakeController {
  constructor(private readonly snake: SnakeService) {}

  @Get('config')
  getConfig() {
    return this.snake.getConfig();
  }

  @UseGuards(AuthenticationGuard)
  @Get('active')
  active(@Req() req: { user: { id: number } }) {
    return this.snake.getActiveRound(req.user.id);
  }

  @UseGuards(AuthenticationGuard)
  @Get('history')
  history(
    @Req() req: { user: { id: number } },
    @Query('limit') limit?: string,
  ) {
    return this.snake.getHistory(req.user.id, Number(limit) || 10);
  }

  @UseGuards(AuthenticationGuard)
  @Post('rounds')
  place(
    @Req() req: { user: { id: number } },
    @Body() body: PlaceSnakeRoundDto,
  ) {
    return this.snake.placeRound({
      userId: req.user.id,
      stake: body.stake,
      currencyCode: body.currencyCode ?? 'KZT',
    });
  }

  @UseGuards(AuthenticationGuard)
  @Post('rounds/:id/heartbeat')
  heartbeat(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: HeartbeatDto,
  ) {
    return this.snake.heartbeat({
      userId: req.user.id,
      roundId: id,
      boosting: body.boosting,
      length: body.length,
      kills: body.kills,
    });
  }

  @UseGuards(AuthenticationGuard)
  @Post('rounds/:id/cashout')
  cashout(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SettleSnakeRoundDto,
  ) {
    return this.snake.cashout({
      userId: req.user.id,
      roundId: id,
      length: body.length,
      kills: body.kills,
      boostMs: body.boostMs ?? 0,
    });
  }

  @UseGuards(AuthenticationGuard)
  @Post('rounds/:id/crash')
  crash(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SettleSnakeRoundDto,
  ) {
    return this.snake.crash({
      userId: req.user.id,
      roundId: id,
      length: body.length,
      kills: body.kills,
      boostMs: body.boostMs ?? 0,
    });
  }
}
