import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '~/prisma/prisma.module';

import { KickCredentialService } from './kick-credential.service';
import { KickDevService } from './kick-dev.service';
import { KickTokenService } from './kick-token.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [KickDevService, KickCredentialService, KickTokenService],
  exports: [KickTokenService],
})
export class KickTokenModule {}
