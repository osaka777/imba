import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CybersportService } from './cybersport.service';

@ApiTags('Cybersport')
@Controller('cybersport')
export class CybersportController {
  constructor(private readonly cybersport: CybersportService) {}

  @Get('status')
  status() {
    return { enabled: this.cybersport.isEnabled() };
  }

  @Get('counts')
  counts() {
    return this.cybersport.counts();
  }

  @Get('live')
  live(@Query('sport') sport?: string, @Query('limit') limit?: string) {
    const parsedLimit = Number(limit);
    return this.cybersport.listLive(
      sport,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 24,
    );
  }

  @Get('line')
  line(
    @Query('sport') sport?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);
    return this.cybersport.listLine(
      sport,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 24,
      Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
    );
  }

  @Get('game/:eventId')
  async game(@Param('eventId') eventId: string) {
    const game = await this.cybersport.getGame(eventId);
    if (!game) throw new NotFoundException('Cybersport event not found');
    return game;
  }
}
