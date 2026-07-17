import { Module, forwardRef } from '@nestjs/common';

import { SupportRateLimitGuard } from '~/common/guards/support-rate-limit.guard';
import { TelegramModule } from '~/main/telegram/telegram.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  controllers: [SupportController],
  imports: [PrismaModule, TelegramModule, forwardRef(() => AuthenticationModule)],
  providers: [SupportService, SupportRateLimitGuard],
})
export class SupportModule {}
