import { Module, forwardRef } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';

import { BetParserModule } from '~/integrations/odds-corp/bet-parser.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { AuthenticationModule } from '../user/authentication/authentication.module';
import { SubcategoryModule } from '../subcategory/subcategory.module';
import { BetApiModule } from '~/integrations/betapi/betapi.module';
import { EventModule } from '../event/event.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameCleanupService } from './game-cleanup.service';
import { GameMarketsService } from './game-markets.service';
import { EventMarketsService } from './event-markets.service';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [GameController],
  exports: [GameService, GameCleanupService, GameMarketsService, EventMarketsService],
  imports: [PrismaModule, BetParserModule, AuthenticationModule, SubcategoryModule, forwardRef(() => BetApiModule), forwardRef(() => EventModule), WinstonModule],
  providers: [GameService, GameCleanupService, GameMarketsService, EventMarketsService, ConfigService],
})
export class GameModule {}
