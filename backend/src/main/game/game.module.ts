import { Module, forwardRef } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';

import { BetParserModule } from '~/integrations/odds-corp/bet-parser.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { AuthenticationModule } from '../user/authentication/authentication.module';
import { SubcategoryModule } from '../subcategory/subcategory.module';
import { BetApiModule } from '~/integrations/betapi/betapi.module';
import { EventModule } from '../event/event.module';
import { CybersportModule } from '~/integrations/cybersport/cybersport.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameCleanupService } from './game-cleanup.service';
import { GameMarketsService } from './game-markets.service';
import { EventMarketsService } from './event-markets.service';
import { MatchResultsService } from './match-results.service';
import { ConfigService } from '@nestjs/config';
import { OlimpbetAuthService } from '~/integrations/olimpbet-wc/olimpbet-auth.service';
import { OlimpbetHttpClient } from '~/integrations/olimpbet-wc/olimpbet-http.client';
import { OlimpbetWcService } from '~/integrations/olimpbet-wc/olimpbet-wc.service';

@Module({
  controllers: [GameController],
  exports: [GameService, GameCleanupService, GameMarketsService, EventMarketsService, MatchResultsService],
  imports: [PrismaModule, BetParserModule, AuthenticationModule, SubcategoryModule, forwardRef(() => BetApiModule), forwardRef(() => EventModule), WinstonModule, CybersportModule],
  providers: [
    GameService,
    GameCleanupService,
    GameMarketsService,
    EventMarketsService,
    MatchResultsService,
    ConfigService,
    OlimpbetAuthService,
    OlimpbetHttpClient,
    OlimpbetWcService,
  ],
})
export class GameModule {}
