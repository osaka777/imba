import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '~/prisma/prisma.module';

import { OperationModule } from '../operation/operation.module';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';

@Module({
  controllers: [PartnersController],
  exports: [PartnersService],
  imports: [PrismaModule, forwardRef(() => OperationModule)],
  providers: [PartnersService],
})
export class PartnersModule {}
