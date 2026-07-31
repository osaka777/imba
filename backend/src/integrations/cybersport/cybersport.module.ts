import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '~/prisma/prisma.module';

import { OneWinWcModule } from '../onewin-wc/onewin-wc.module';

import { CybersportController } from './cybersport.controller';
import { CybersportService } from './cybersport.service';

@Module({
  imports: [ConfigModule, PrismaModule, OneWinWcModule],
  controllers: [CybersportController],
  providers: [CybersportService],
  exports: [CybersportService],
})
export class CybersportModule {}
