import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '~/prisma/prisma.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';

import { FcmService } from './fcm.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushUserNotifyService } from './push-user-notify.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthenticationModule)],
  controllers: [PushController],
  providers: [PushService, PushUserNotifyService, FcmService],
  exports: [PushUserNotifyService],
})
export class PushModule {}
