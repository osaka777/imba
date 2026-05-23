import { Controller, Get, Param, Post, HttpCode, HttpStatus, Logger } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { BetApiService } from '~/integrations/betapi/betapi.service';


@Controller('v2/')
export class BetApiController {
  private readonly logger = new Logger(BetApiController.name);

  constructor(
    private readonly BetApiService: BetApiService,
  ) {}

  @Get('countries/:sportId/:dataType/')
  async countries(
    @Param('sportId') sportId: number = 0,
    @Param('dataType') dataType: 'line' | 'live',
  ) {
    return await this.BetApiService.getCountries(sportId, dataType);
  }

  @Get('events/:sportId/:tournamentId/:dataType/')
  async events(
    @Param('sportId') sportId: number = 0,
    @Param('tournamentId') tournamentId: number = 0,
    @Param('dataType') dataType: 'line' | 'live',
  ) {
    return await this.BetApiService.getEvents(sportId, tournamentId, dataType);
  }

  @Get('oc')
  async oc() {
    // TODO: transform data for frontend?
    return await this.BetApiService.processGameOcList();
  }

  @Get('sports/:dataType')
  async sports(@Param('dataType') dataType: 'line' | 'live') {
    // TODO: transform data for frontend?
    return await this.BetApiService.getSports(dataType);
  }

  @Get('tournaments/:sportId/:countryId/:dataType/')
  async tournaments(
    @Param('sportId') sportId: number = 0,
    @Param('countryId') countryId: number = 0,
    @Param('dataType') dataType: 'line' | 'live',
  ) {
    return await this.BetApiService.getTournaments(
      sportId,
      countryId,
      dataType,
    );
  }



  @Post('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
