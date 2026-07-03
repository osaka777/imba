import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '~/prisma/prisma.module';
import { TelegramModule } from '~/main/telegram/telegram.module';

import { PhoneVerificationService } from '../user/phone-verification.service';

@Module({
  imports: [PrismaModule, forwardRef(() => TelegramModule)],
  providers: [PhoneVerificationService],
  exports: [PhoneVerificationService],
})
export class PhoneVerificationModule {}
