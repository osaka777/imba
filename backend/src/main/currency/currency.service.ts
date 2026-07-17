import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import { CurrencyNotFound } from './exception/currency-not-found.exception';

const HIDDEN_CURRENCY_CODES = ['USD', 'UAH', 'TRY', 'UZS', 'AZN', 'KGS', 'TJS'] as const;

@Injectable()
export class CurrencyService {
  constructor(private readonly prismaService: PrismaService) {}

  async getAll() {
    return this.prismaService.currency.findMany({
      where: { isoCode: { notIn: [...HIDDEN_CURRENCY_CODES] } },
      orderBy: { isoCode: 'asc' },
    });
  }

  async getCurrency(isoCode: string) {
    const currency = await this.prismaService.currency.findFirst({
      where: { isoCode },
    });
    if (currency == null) {
      throw new CurrencyNotFound();
    }

    return currency;
  }
}
