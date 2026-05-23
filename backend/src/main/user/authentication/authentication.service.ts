import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare } from 'bcrypt';
import { Logger } from 'winston';

import { UserDto } from '../dto/user.dto';
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
    @Inject('winston')
    private readonly logger: Logger,
  ) {}

  /**
   * Authenticates a profile based on the provided AuthenticateDto.
   * @param dto - The data transfer object containing profile authentication information.
   * @returns An object with the authenticated profile and access token.
   */
  async authenticate(dto: AuthenticateDto): Promise<{
    accessToken: string;
    user: UserDto;
  }> {
    const defaultLogMeta = {
      class: 'AuthenticationService',
      data: { dto },
      method: 'authenticate',
    };
    this.logger.debug('authenticating', defaultLogMeta);

    const user = await this.usersService.findByEmail(dto.email);

    // Handle case where profile is not found
    if (user === null) {
      this.logger.debug('profile not found', defaultLogMeta);
      throw new UnauthenticatedException();
    }

    // Check if the password provided matches the profile's password
    if (!(await compare(dto.password, user.password))) {
      this.logger.debug('invalid password', defaultLogMeta);
      throw new UnauthenticatedException();
    }

    // Authenticate the profile and generate an access token
    const result = {
      accessToken: await this.authenticateUser(user),
      user: new UserDto(user),
    };

    this.logger.debug('authenticated', defaultLogMeta);
    return result;
  }

  /**
   * Generates a JWT token for the authenticated profile.
   * @param user - The profile for whom the JWT token is being generated.
   * @returns The generated access token.
   */
  async authenticateUser(user: User): Promise<string> {
    const defaultLogMeta = {
      class: 'AuthenticationService',
      data: { user_id: user.id },
      method: 'authenticateUser',
    };
    this.logger.debug('generating JWT token', defaultLogMeta);

    // Sign the JWT token with profile details
    const accessToken = await this.jwtService.signAsync(
      {
        email: user.email,
        id: user.id,
      },
      {
        expiresIn: 2592000, // 30 days
        secret: this.configService.get<string>('JWT_SECRET'),
      },
    );

    this.logger.debug('authenticated', defaultLogMeta);
    return accessToken;
  }

  async register(dto: RegistrationDto) {
    const defaultLogMeta = {
      class: 'AuthenticationService',
      data: { dto },
      method: 'register',
    };

    this.logger.debug('Checking if email is unique', defaultLogMeta);

    const user = await this.usersService.create(dto);

    this.logger.debug('User registered', {
      ...defaultLogMeta,
      userId: user.id,
    });

    return user;
  }

  /**
   * Verifies the JWT token and returns profile data.
   * @param token - The JWT token to verify.
   * @returns The profile data extracted from the token.
   */
  async verify(token: string) {
    const defaultLogMeta = {
      class: 'AuthenticationService',
      method: 'verify',
    };
    this.logger.debug('verifying JWT token', defaultLogMeta);

    // Verify the JWT token and extract profile data
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
