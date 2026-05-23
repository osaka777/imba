import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { HttpException } from '~/common/types/http-exception';

import { AuthenticationGuard } from './authentication.guard';
import { AuthRateLimitGuard } from '~/common/guards/auth-rate-limit.guard';
import { AuthenticationService } from './authentication.service';
import { SuperuserGuard } from './superuser.guard';
import { AuthenticateDto, AuthenticateResultDto } from './dto/authenticate.dto';
import { RegistrationDto } from './dto/registration.dto';

@Controller('')
@ApiTags('Auth')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('sign-in')
  @UseGuards(AuthRateLimitGuard)
  @ApiBadRequestResponse({ type: HttpException })
  @ApiUnauthorizedResponse({ type: HttpException })
  async authenticate(
    @Body() body: AuthenticateDto,
  ): Promise<AuthenticateResultDto> {
    const result = await this.authenticationService.authenticate(body);
    return new AuthenticateResultDto({
      accessToken: result.accessToken,
    });
  }

  @Post('sign-up')
  @UseGuards(AuthRateLimitGuard)
  @ApiBadRequestResponse({ type: HttpException })
  async register(
    @Body() body: RegistrationDto,
  ): Promise<AuthenticateResultDto> {
    const user = await this.authenticationService.register(body);

    return new AuthenticateResultDto({
      accessToken: await this.authenticationService.authenticateUser(user),
    });
  }

  @Get('verify')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async verify() {}

  @Get('verify-superuser')
  @UseGuards(AuthRateLimitGuard, SuperuserGuard)
  @ApiBearerAuth()
  async verifySuperuser() {
    return { valid: true, message: 'SUPERUSER_TOKEN is valid' };
  }
}
