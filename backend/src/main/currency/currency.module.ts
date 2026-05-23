import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

@Module({
  controllers: [CurrencyController],
  exports: [CurrencyService],
  imports: [PrismaModule],
  providers: [CurrencyService],
})
export class CurrencyModule {}
