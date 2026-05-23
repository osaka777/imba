import { Module, forwardRef } from '@nestjs/common';

import { EventModule } from '~/main/event/event.module';
import { GameModule } from '~/main/game/game.module';

import { PrismaModule } from '~/prisma/prisma.module';

import { BetApiModule } from '~/integrations/betapi/betapi.module';
import { BetParserModule } from './bet-parser.module';
import { OddsCorpGateway } from './odds-corp.gateway';
import { OddsCorpService } from './odds-corp.service';

@Module({
  exports: [OddsCorpGateway],
  imports: [GameModule, EventModule, PrismaModule, forwardRef(() => BetApiModule), BetParserModule],
  providers: [OddsCorpService, OddsCorpGateway],
})
export class OddsCorpModule {}
