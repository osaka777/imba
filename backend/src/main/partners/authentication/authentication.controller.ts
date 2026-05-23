import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiTags } from '@nestjs/swagger';

import { HttpException } from '~/common/types/http-exception';
import { AuthRateLimitGuard } from '~/common/guards/auth-rate-limit.guard';

import { AuthenticationService } from './authentication.service';
import { PartnersLoginDto } from './dto/login.dto';
import { PartnerRegistrationDto } from './dto/register.dto';

@Controller('affiliate-program')
export class AuthenticationController {
  constructor(private authenticationService: AuthenticationService) {}

  @Post('sign-in')
  @UseGuards(AuthRateLimitGuard)
  @ApiBadRequestResponse({ type: HttpException })
  @ApiTags('Partners')
  async login(@Body() body: PartnersLoginDto) {
    return this.authenticationService.login(body);
  }

  @Post('sign-up')
  @UseGuards(AuthRateLimitGuard)
  @ApiBadRequestResponse({ type: HttpException })
  @ApiTags('Partners')
  async register(@Body() req: PartnerRegistrationDto) {
    const user = await this.authenticationService.register(req);
    const accessToken = await this.authenticationService.authenticateUser(user);

    return {
      accessToken,
      user,
    };
  }
}
