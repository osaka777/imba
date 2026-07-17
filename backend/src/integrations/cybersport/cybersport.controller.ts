import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CYBERSPORT_CATALOG } from './cybersport-catalog';
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

  @Get('disciplines')
  disciplines() {
    return CYBERSPORT_CATALOG.map(({ olimpbetId, apiSport, pathSlug, label }) => ({
      olimpbetId,
      apiSport,
      pathSlug,
      label,
    }));
  }

  @Get('tournaments')
  tournaments(@Query('sport') sport?: string) {
    return this.cybersport.listTournaments(sport);
  }

  @Get('live')
  live(
    @Query('sport') sport?: string,
    @Query('limit') limit?: string,
    @Query('tournament') tournament?: string,
  ) {
    const parsedLimit = Number(limit);
    const tournamentId = Number(tournament);
    return this.cybersport.listLive(
      sport,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 24,
      Number.isFinite(tournamentId) && tournamentId > 0 ? tournamentId : undefined,
    );
  }

  @Get('line')
  line(
    @Query('sport') sport?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('tournament') tournament?: string,
  ) {
    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);
    const tournamentId = Number(tournament);
    return this.cybersport.listLine(
      sport,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 24,
      Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
      Number.isFinite(tournamentId) && tournamentId > 0 ? tournamentId : undefined,
    );
  }

  @Get('game/:eventId')
  async game(@Param('eventId') eventId: string) {
    const game = await this.cybersport.getGame(eventId);
    if (!game) throw new NotFoundException('Cybersport event not found');
    return game;
  }
}
