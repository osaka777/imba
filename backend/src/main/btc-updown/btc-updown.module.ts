import { Module } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { BtcUpdownController } from './btc-updown.controller';
import { BtcUpdownPriceService } from './btc-updown-price.service';
import { BtcUpdownService } from './btc-updown.service';

@Module({
  imports: [PrismaModule, OperationModule, AuthenticationModule],
  controllers: [BtcUpdownController],
  providers: [BtcUpdownPriceService, BtcUpdownService],
  exports: [BtcUpdownService],
})
export class BtcUpdownModule {}
