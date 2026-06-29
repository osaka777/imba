import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { Logger } from 'winston';

import { PartnersService } from '~/main/partners/partners.service';
import { PrismaService } from '~/prisma/prisma.service';
import { CurrencyService } from '~/main/currency/currency.service';

import { UnauthenticatedException } from './authentication/exception/unauthenticated.exception';
import { CreateUserDto } from './dto/create-user.dto';
import { EmailIsAlreadyTakenException } from './exception/email-is-already-taken.exception';

@Injectable()
export class UserService {
  constructor(
    private readonly config: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly partnersService: PartnersService,
    private readonly currencyService: CurrencyService,
    @Inject('winston')
    private readonly logger: Logger,
  ) {}

  async create(dto: CreateUserDto) {
    if (await this.isEmailTaken(dto.email)) {
      throw new EmailIsAlreadyTakenException();
    }

    const currencyCode = dto.currencyCode.toUpperCase();
    await this.currencyService.getCurrency(currencyCode);

    const birthDate = new Date(dto.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      throw new BadRequestException('Invalid birth date');
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0
      || (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }
    if (age < 18) {
      throw new BadRequestException('You must be at least 18 years old');
    }

    let hashedPassword;
    if (dto.password) {
      hashedPassword = await hash(
        dto.password,
        this.config.get<string>('PASSWORD_HASH_SALT'),
      );
    }

    const user = await this.prismaService.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        birthDate,
        defaultCurrencyCode: currencyCode,
        balances: {
          create: {
            currencyCode,
            amount: 0,
          },
        },
      },
    });

    this.logger.debug('profile created', {
      class: 'UserService',
      data: { dto },
      method: 'create',
      user_id: user.id,
    });

    await this.partnersService.connectAffiliator(user, dto.tag);
    // await this.emailService.sendConfirmation(user.id, user.email)

    return user;
  }

  async findByEmail(email: string) {
    return this.prismaService.user.findFirst({
      where: { email },
    });
  }

  async findById(id: number, include: Prisma.UserInclude = {}) {
    const user = await this.prismaService.user.findFirst({
      include: {
        ...include,
        bonusBalances: true, // Добавляем бонусные балансы
      },
      where: { id },
    });

    return user;
  }

  async isEmailTaken(email: string) {
    const users = await this.prismaService.user.count({
      where: { email },
    });
    return users !== 0;
  }

  async updatePassword(
    userId: number,
    dto: { newPassword: string; oldPassword?: string },
  ) {
    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
      },
    });
    if (
      user.password &&
      dto.oldPassword != null &&
      !(await compare(dto.oldPassword, user.password))
    ) {
      throw new UnauthenticatedException();
    }
    if (user.password && !dto.oldPassword) {
      throw new UnauthenticatedException();
    }

    const passwordHash = await hash(
      dto.newPassword,
      this.config.get<string>('PASSWORD_HASH_SALT'),
    );
    await this.prismaService.user.update({
      data: {
        password: passwordHash,
      },
      where: {
        id: userId,
      },
    });
  }
}
