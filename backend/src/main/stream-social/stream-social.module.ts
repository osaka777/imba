import { Module } from '@nestjs/common';

import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { StreamSocialController } from './stream-social.controller';
import { StreamSocialHub } from './stream-social.hub';
import { StreamSocialService } from './stream-social.service';

@Module({
  imports: [PrismaModule, AuthenticationModule],
  controllers: [StreamSocialController],
  providers: [StreamSocialService, StreamSocialHub],
  exports: [StreamSocialService],
})
export class StreamSocialModule {}
