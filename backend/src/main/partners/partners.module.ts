import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '~/prisma/prisma.module';

import { OperationModule } from '../operation/operation.module';
import { AffiliatePostbackService } from './affiliate-postback.service';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';

@Module({
  controllers: [PartnersController],
  exports: [PartnersService, AffiliatePostbackService],
  imports: [HttpModule, PrismaModule, forwardRef(() => OperationModule)],
  providers: [PartnersService, AffiliatePostbackService],
})
export class PartnersModule {}
