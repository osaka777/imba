import { Module } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { SnakeController } from './snake.controller';
import { SnakeService } from './snake.service';

@Module({
  imports: [PrismaModule, OperationModule, AuthenticationModule],
  controllers: [SnakeController],
  providers: [SnakeService],
  exports: [SnakeService],
})
export class SnakeModule {}
