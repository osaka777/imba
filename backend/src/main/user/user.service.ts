import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { Logger } from 'winston';

import { BonusBalanceService } from '~/main/bonus-balance/bonus-balance.service';
import { PartnersService } from '~/main/partners/partners.service';
import { PrismaService } from '~/prisma/prisma.service';
import { CurrencyService } from '~/main/currency/currency.service';
import { AffiliateSubsDto } from '~/main/partners/dto/affiliate-subs.dto';
import { telegramAuthEmail } from '~/main/telegram/telegram-auth.util';

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
    private readonly bonusBalanceService: BonusBalanceService,
    @Inject('winston')
    private readonly logger: Logger,
  ) {}

  async create(dto: CreateUserDto, registrationIp?: string, registrationDeviceId?: string) {
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
        registrationIp,
        registrationDeviceId: registrationDeviceId || null,
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

    await this.partnersService.connectAffiliator(
      user,
      dto.tag,
      registrationIp,
      dto.subs,
    );

    await this.bonusBalanceService.grantWelcomeOffer(user.id, currencyCode);

    if (dto.promoCode?.trim()) {
      const partnerFromPromo = await this.partnersService.resolvePartnerUserIdFromPromoCode(
        dto.promoCode,
      );
      if (partnerFromPromo) {
        await this.partnersService.connectAffiliatorByPartnerUserId(
          user,
          partnerFromPromo,
          registrationIp,
          dto.subs,
        );
      }
      try {
        await this.bonusBalanceService.applyPromoCode(user.id, dto.promoCode.trim());
      } catch (err) {
        this.logger.debug('promo not applied on registration', {
          userId: user.id,
          promoCode: dto.promoCode,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // await this.emailService.sendConfirmation(user.id, user.email)

    return user;
  }

  async findByEmail(email: string) {
    return this.prismaService.user.findFirst({
      where: { email },
    });
  }

  async findByTelegramUserId(telegramUserId: string) {
    return this.prismaService.user.findFirst({
      where: { telegramUserId },
    });
  }

  async createFromTelegram(args: {
    telegramUserId: string;
    telegramUsername: string | null;
    firstName: string;
    currencyCode: string;
    birthDate: string;
    tag?: string;
    promoCode?: string;
    subs?: AffiliateSubsDto;
    registrationIp?: string;
    registrationDeviceId?: string;
  }) {
    const currencyCode = args.currencyCode.toUpperCase();
    await this.currencyService.getCurrency(currencyCode);

    const birthDate = new Date(args.birthDate);
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

    const email = telegramAuthEmail(args.telegramUserId);
    if (await this.isEmailTaken(email)) {
      throw new BadRequestException('Telegram account is already registered');
    }

    const user = await this.prismaService.user.create({
      data: {
        email,
        password: null,
        birthDate,
        defaultCurrencyCode: currencyCode,
        telegramUserId: args.telegramUserId,
        telegramUsername: args.telegramUsername,
        telegramLinkedAt: new Date(),
        registrationIp: args.registrationIp,
        registrationDeviceId: args.registrationDeviceId || null,
        balances: {
          create: {
            currencyCode,
            amount: 0,
          },
        },
      },
    });

    this.logger.debug('telegram profile created', {
      class: 'UserService',
      method: 'createFromTelegram',
      user_id: user.id,
      telegramUserId: args.telegramUserId,
    });

    await this.partnersService.connectAffiliator(
      user,
      args.tag,
      args.registrationIp,
      args.subs,
    );

    await this.bonusBalanceService.grantWelcomeOffer(user.id, currencyCode);

    if (args.promoCode?.trim()) {
      const partnerFromPromo = await this.partnersService.resolvePartnerUserIdFromPromoCode(
        args.promoCode,
      );
      if (partnerFromPromo) {
        await this.partnersService.connectAffiliatorByPartnerUserId(
          user,
          partnerFromPromo,
          args.registrationIp,
          args.subs,
        );
      }
      try {
        await this.bonusBalanceService.applyPromoCode(user.id, args.promoCode.trim());
      } catch (err) {
        this.logger.debug('promo not applied on telegram registration', {
          userId: user.id,
          promoCode: args.promoCode,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return user;
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

  async findSettingsProfile(id: number) {
    return this.prismaService.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
        telegramLinkedAt: true,
        telegramUsername: true,
        avatarPreset: true,
      },
    });
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

  async updateAvatarPreset(userId: number, preset: string | null) {
    await this.prismaService.user.update({
      where: { id: userId },
      data: { avatarPreset: preset },
    });
  }
}
