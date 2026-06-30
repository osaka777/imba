import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { HttpException } from '~/common/types/http-exception';
import { extractClientIp } from '~/common/utils/client-ip.util';

import { AuthenticationGuard } from './authentication.guard';
import { AuthRateLimitGuard } from '~/common/guards/auth-rate-limit.guard';
import { AuthenticationService } from './authentication.service';
import { SuperuserGuard } from './superuser.guard';
import {
  AuthenticateDto,
  AuthenticateResultDto,
  VerifyTelegram2faDto,
} from './dto/authenticate.dto';
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
    @Req() request: Request,
  ): Promise<AuthenticateResultDto> {
    const deviceId = request.headers['x-client-device-id'] as string | undefined;
    const result = await this.authenticationService.authenticate(
      body,
      deviceId,
      extractClientIp(request),
    );
    return new AuthenticateResultDto(result);
  }

  @Post('auth/verify-telegram-2fa')
  @UseGuards(AuthRateLimitGuard)
  async verifyTelegram2fa(
    @Body() body: VerifyTelegram2faDto,
    @Req() request: Request,
  ): Promise<AuthenticateResultDto> {
    const deviceId = body.deviceId ?? (request.headers['x-client-device-id'] as string | undefined);
    const result = await this.authenticationService.verifyTelegram2fa(
      body.twoFaToken,
      body.code,
      deviceId,
    );
    return new AuthenticateResultDto({
      accessToken: result.accessToken,
    });
  }

  @Post('sign-up')
  @UseGuards(AuthRateLimitGuard)
  @ApiBadRequestResponse({ type: HttpException })
  async register(
    @Body() body: RegistrationDto,
    @Req() request: Request,
  ): Promise<AuthenticateResultDto> {
    const user = await this.authenticationService.register(body, request);

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
