import { Module, forwardRef } from '@nestjs/common';
import { BonusBalanceController } from './bonus-balance.controller';
import { PromoController } from './promo.controller';
import { BonusBalanceService } from './bonus-balance.service';
import { AutoBonusService } from './auto-bonus.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { PartnersModule } from '../partners/partners.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthenticationModule), PartnersModule],
  controllers: [BonusBalanceController, PromoController],
  providers: [BonusBalanceService, AutoBonusService],
  exports: [BonusBalanceService, AutoBonusService],
})
export class BonusBalanceModule {} 