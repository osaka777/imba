import { Module, forwardRef } from '@nestjs/common';

import { BetParserModule } from '~/integrations/odds-corp/bet-parser.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { UserModule } from '~/main/user/user.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { OperationController } from './operation.controller';
import { OperationService } from './operation.service';

@Module({
  controllers: [OperationController],
  exports: [OperationService],
  imports: [
    PrismaModule,
    forwardRef(() => AuthenticationModule),
    BetParserModule,
    forwardRef(() => UserModule),
  ],
  providers: [OperationService],
})
export class OperationModule {}
