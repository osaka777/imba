import { Module } from '@nestjs/common';
import { BonusBalanceController } from './bonus-balance.controller';
import { PromoController } from './promo.controller';
import { BonusBalanceService } from './bonus-balance.service';
import { AutoBonusService } from './auto-bonus.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';

@Module({
  imports: [PrismaModule, AuthenticationModule],
  controllers: [BonusBalanceController, PromoController],
  providers: [BonusBalanceService, AutoBonusService],
  exports: [BonusBalanceService, AutoBonusService],
})
export class BonusBalanceModule {} 