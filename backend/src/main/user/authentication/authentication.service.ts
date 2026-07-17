import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare } from 'bcrypt';
import type { Request } from 'express';
import { Logger } from 'winston';

import { extractClientIp } from '~/common/utils/client-ip.util';
import { Telegram2faService } from '~/main/telegram/telegram-2fa.service';

import { UserService } from '../user.service';
import { AuthenticateDto } from './dto/authenticate.dto';
import { RegistrationDto } from './dto/registration.dto';
import { UnauthenticatedException } from './exception/unauthenticated.exception';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly telegram2fa: Telegram2faService,
    @Inject('winston')
    private readonly logger: Logger,
  ) {}

  async authenticate(
    dto: AuthenticateDto,
    deviceId?: string,
    requestIp?: string,
  ): Promise<{
    accessToken?: string;
    requires2fa?: boolean;
    twoFaToken?: string;
  }> {
    const defaultLogMeta = {
      class: 'AuthenticationService',
      data: { dto: { email: dto.email } },
      method: 'authenticate',
    };
    this.logger.debug('authenticating', defaultLogMeta);

    const user = await this.usersService.findByEmail(dto.email);

    if (user === null) {
      this.logger.debug('profile not found', defaultLogMeta);
      throw new UnauthenticatedException();
    }

    if (!(await compare(dto.password, user.password))) {
      this.logger.debug('invalid password', defaultLogMeta);
      throw new UnauthenticatedException();
    }

    const needs2fa = await this.telegram2fa.shouldChallenge(user, deviceId);
    if (needs2fa && user.telegramUserId) {
      const challenge = await this.telegram2fa.createChallenge({
        userId: user.id,
        telegramUserId: user.telegramUserId,
        requestIp,
      });
      return {
        requires2fa: true,
        twoFaToken: challenge.twoFaToken,
      };
    }

    await this.telegram2fa.rememberDevice(user.id, deviceId);

    return {
      accessToken: await this.authenticateUser(user),
    };
  }

  async verifyTelegram2fa(
    twoFaToken: string,
    code: string,
    deviceId?: string,
  ): Promise<{ accessToken: string }> {
    const { userId } = await this.telegram2fa.verifyChallenge({
      twoFaToken,
      code,
      deviceId,
    });
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthenticatedException();
    }
    return {
      accessToken: await this.authenticateUser(user),
    };
  }

  async authenticateUser(user: User): Promise<string> {
    const defaultLogMeta = {
      class: 'AuthenticationService',
      data: { user_id: user.id },
      method: 'authenticateUser',
    };
    this.logger.debug('generating JWT token', defaultLogMeta);

    const accessToken = await this.jwtService.signAsync(
      {
        email: user.email,
        id: user.id,
      },
      {
        expiresIn: 2592000,
        secret: this.configService.get<string>('JWT_SECRET'),
      },
    );

    this.logger.debug('authenticated', defaultLogMeta);
    return accessToken;
  }

  async register(dto: RegistrationDto, request?: Request) {
    const defaultLogMeta = {
      class: 'AuthenticationService',
      data: { dto: { email: dto.email } },
      method: 'register',
    };

    this.logger.debug('Checking if email is unique', defaultLogMeta);

    const registrationIp = request ? extractClientIp(request) : undefined;
    const deviceId = request?.headers['x-client-device-id'] as string | undefined;
    const user = await this.usersService.create(dto, registrationIp, deviceId);

    this.logger.debug('User registered', {
      ...defaultLogMeta,
      userId: user.id,
    });

    return user;
  }

  async verify(token: string) {
    const defaultLogMeta = {
      class: 'AuthenticationService',
      method: 'verify',
    };
    this.logger.debug('verifying JWT token', defaultLogMeta);

    type TokenData = {
      email: string;
      id: string;
    };
    try {
      const user = await this.jwtService.verifyAsync<TokenData>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      this.logger.debug('JWT token verified', defaultLogMeta);
      return user;
    } catch {
      throw new UnauthenticatedException();
    }
  }
}
