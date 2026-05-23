import { Module, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaModule } from '~/prisma/prisma.module';
import { GameModule } from '../game/game.module';

import { EventGateway } from './event.gateway';
import { EventBridgeService } from './event-bridge.service';
import { EventController } from './event.controller';

@Module({
  exports: [EventGateway, EventBridgeService],
  imports: [PrismaModule, forwardRef(() => GameModule)],
  providers: [EventGateway, EventBridgeService, JwtService],
  controllers: [EventController],
})
export class EventModule {}
