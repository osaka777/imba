import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import * as crypto from 'crypto';

import { PartnersService } from '~/main/partners/partners.service';
import { UserDto } from '~/main/user/dto/user.dto';
import { UserService } from '~/main/user/user.service';
import { PrismaService } from '~/prisma/prisma.service';

import { PartnersLoginDto } from './dto/login.dto';
import { PartnerRegistrationDto } from './dto/register.dto';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly userService: UserService,
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly partnersService: PartnersService,
  ) {}

  authenticateUser(user: User): Promise<string> {
    return this.jwtService.signAsync(
      {
        email: user.email,
        id: user.id,
        userType: 'partner',
      },
      {
        expiresIn: 24 * 60 * 60, // 1 day
        secret: this.configService.get<string>('JWT_SECRET'),
      },
    );
  }

  async login(
    dto: PartnersLoginDto,
  ): Promise<{ accessToken: string; user: UserDto }> {
    const user = await this.prismaService.user.findFirst({
      include: {
        affilator: true,
      },
      where: { NOT: { affilator: null }, email: dto.email },
    });

    if (user === null) {
      throw new UnauthorizedException();
    }

    if (!(await compare(dto.password, user.password))) {
      throw new UnauthorizedException();
    }

    return {
      accessToken: await this.authenticateUser(user),
      user: new UserDto(user),
    };
  }

  async register(dto: PartnerRegistrationDto) {
    try {
      
      // Проверяем, что email не занят
      if (await this.userService.isEmailTaken(dto.email)) {
        throw new BadRequestException(['Email уже занят']);
      }

    // Хешируем пароль
    const hashedPassword = await hash(
      dto.password,
      this.configService.get<string>('PASSWORD_HASH_SALT'),
    );

    // Создаем пользователя и партнера в транзакции
    const result = await this.prismaService.$transaction(async (prisma) => {
    // Создаем пользователя
      const user = await prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
        },
      });


    // Создаем запись партнера
      const affilator = await prisma.affilator.create({
      data: {
          meta: dto.meta ? JSON.parse(JSON.stringify(dto.meta)) : null,
        trafficSource: dto.trafficSource,
        type: dto.type,
        userId: user.id,
        uid: crypto.randomUUID(), // Генерируем уникальный ID
        percent: dto.type === 'REVSHARE' ? 50 : 0, // Процент для REVSHARE (50% по умолчанию)
        affilatorsPercent: dto.type === 'REVSHARE' ? 10 : 0, // Процент для рефералов
      },
    });


    // Если указан реферальный код (tag), проверяем его
    if (dto.tag) {
        const referringAffiliator = await prisma.affilator.findFirst({
        where: {
          uid: dto.tag,
        },
      });

      // Если найден реферальный партнер, связываем только для отслеживания, но не для комиссий
      if (referringAffiliator) {
          await prisma.user.update({
          data: {
            affiliatedById: referringAffiliator.userId,
          },
          where: {
            id: user.id,
          },
        });
      }
    }

    return user;
    });

    return result;
    } catch (error) {
      console.error('❌ Ошибка при регистрации партнера:', error);
      throw error;
    }
  }


  async verify(token: string): Promise<UserDto> {
    const payload = this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('JWT_SECRET'),
    });

    // @ts-expect-error i dont care
    if (payload.userType === 'partner') {
      return payload;
    }
    throw new UnauthorizedException();
  }
}
