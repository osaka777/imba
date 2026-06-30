import { Module, forwardRef } from '@nestjs/common';

import { CurrencyModule } from '~/main/currency/currency.module';
import { BonusBalanceModule } from '~/main/bonus-balance/bonus-balance.module';
import { PartnersModule } from '~/main/partners/partners.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { AuthenticationModule } from './authentication/authentication.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  exports: [UserService],
  imports: [
    CurrencyModule,
    PrismaModule,
    PartnersModule,
    BonusBalanceModule,
    forwardRef(() => AuthenticationModule),
  ],
  providers: [UserService],
})
export class UserModule {}
