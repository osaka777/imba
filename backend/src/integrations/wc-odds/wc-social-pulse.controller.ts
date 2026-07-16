import { Controller, Get } from '@nestjs/common';

import { WcSocialPulseService } from './wc-social-pulse.service';

@Controller('feed/social')
export class WcSocialPulseController {
  constructor(private readonly socialPulse: WcSocialPulseService) {}

  @Get('pulse')
  pulse() {
    return this.socialPulse.getPulse();
  }
}
