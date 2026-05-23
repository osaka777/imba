import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import { CurrencyNotFound } from './exception/currency-not-found.exception';

@Injectable()
export class CurrencyService {
  constructor(private readonly prismaService: PrismaService) {}

  async getAll() {
    return this.prismaService.currency.findMany();
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
