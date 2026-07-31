import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { OperationModule } from '../operation/operation.module';
import { EventModule } from '../event/event.module';
import { DepositModule } from '../deposit/deposit.module';
import { PartnersModule } from '../partners/partners.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminWelcomeBonusAnalyticsService } from './admin-welcome-bonus-analytics.service';
import { AdminMetrikaService } from './admin-metrika.service';

@Module({
  imports: [PrismaModule, AuthenticationModule, OperationModule, EventModule, DepositModule, PartnersModule],
  controllers: [AdminController],
  providers: [AdminService, AdminWelcomeBonusAnalyticsService, AdminMetrikaService],
  exports: [AdminService],
})
export class AdminModule {}
