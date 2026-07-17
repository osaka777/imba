import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { OperationModule } from '../operation/operation.module';
import { EventModule } from '../event/event.module';
import { DepositModule } from '../deposit/deposit.module';
import { PartnersModule } from '../partners/partners.module';
import { BonusBalanceModule } from '../bonus-balance/bonus-balance.module';
import { KickDevModule } from '../../integrations/kick-dev/kick-dev.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminWelcomeBonusAnalyticsService } from './admin-welcome-bonus-analytics.service';

@Module({
  imports: [PrismaModule, AuthenticationModule, OperationModule, EventModule, DepositModule, PartnersModule, BonusBalanceModule, KickDevModule],
  controllers: [AdminController],
  providers: [AdminService, AdminWelcomeBonusAnalyticsService],
  exports: [AdminService],
})
export class AdminModule {}
