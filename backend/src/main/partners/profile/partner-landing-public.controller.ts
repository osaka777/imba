import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PartnerLandingService } from './partner-landing.service';

@Controller('affiliate-program/landings')
@ApiTags('Partner landings')
export class PartnerLandingPublicController {
  constructor(private readonly landingService: PartnerLandingService) {}

  @Get('public/:slug')
  async getPublic(@Param('slug') slug: string) {
    return this.landingService.getPublicBySlug(slug);
  }
}
