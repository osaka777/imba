import { Module, forwardRef } from '@nestjs/common';
import { BetApiService } from './betapi.service';
import { BetApiLiveService } from './betapi-live.service';
import { BetApiLineService } from './betapi-line.service';
import { BetApiDetailedService } from './betapi-detailed.service';
import { BetProcessingService } from './bet-processing.service';
import { BetCalculationService } from './bet-calculation.service';
import { BetCalculationController } from './bet-calculation.controller';
import { BetResultsLoggerService } from './bet-results-logger.service';
import { LanguageService } from '~/shared/services/language.service';

import { BetApiWebSocketAdapter } from './betapi-websocket-adapter';
import { BetApiChangeDetector } from './betapi-change-detector';
import { BetApiController } from './betapi.controller';
import { GameModule } from '~/main/game/game.module';
import { PrismaModule } from '~/prisma/prisma.module';
import { OddsCorpModule } from '~/integrations/odds-corp/odds-corp.module';
import { EventModule } from '~/main/event/event.module';
import { EventGateway } from '~/main/event/event.gateway';
import { EventBridgeService } from '~/main/event/event-bridge.service';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { OperationModule } from '~/main/operation/operation.module';
import { TelegramModule } from '~/main/telegram/telegram.module';
import { PushModule } from '~/main/push/push.module';
import { WebSocketConfig } from './betapi-websocket-adapter';
import { ChangeDetectionConfig } from './types/betapi.types';

const WS_CONFIG: WebSocketConfig = {
  bufferSize: 3000,        // Увеличиваем буфер в 3 раза
  bufferTTL: 8000,         // Увеличиваем TTL для стабильности
  maxBatchSize: 100,       // Увеличиваем размер батча в 2 раза
  batchInterval: 50,       // Уменьшаем интервал для быстрой обработки
  reconnectInterval: 1000,
  maxReconnectAttempts: 10
};

const CHANGE_DETECTION_CONFIG: ChangeDetectionConfig = {
  minInterval: 100,         // Уменьшаем минимальный интервал
  adaptiveInterval: true,
  changeThreshold: 0.01,
  maxInterval: 3000,        // Уменьшаем максимальный интервал
  bufferSize: 2000,         // Увеличиваем буфер в 2 раза
  bufferTTL: 8000          // Увеличиваем TTL
};

@Module({
  imports: [
    forwardRef(() => GameModule),
    PrismaModule,
    OddsCorpModule,
    forwardRef(() => EventModule),
    AuthenticationModule,
    OperationModule,
    TelegramModule,
    PushModule,
  ],
  controllers: [
      BetApiController,
      BetCalculationController,
   ],
  providers: [
    BetApiService,
    BetApiLiveService,
    BetApiLineService,
    BetApiDetailedService,
    BetProcessingService,
    BetCalculationService,
    BetResultsLoggerService,
    LanguageService,
    {
      provide: 'WS_CONFIG',
      useValue: WS_CONFIG
    },
    {
      provide: 'CHANGE_DETECTION_CONFIG',
      useValue: CHANGE_DETECTION_CONFIG
    },
    {
      provide: BetApiWebSocketAdapter,
      useFactory: (config: WebSocketConfig) => new BetApiWebSocketAdapter(config),
      inject: ['WS_CONFIG']
    },
    {
      provide: BetApiChangeDetector,
      useFactory: (wsAdapter: BetApiWebSocketAdapter, eventGateway: EventGateway, eventBridge: EventBridgeService, config: ChangeDetectionConfig) => 
        new BetApiChangeDetector(wsAdapter, eventGateway, eventBridge, config),
      inject: [BetApiWebSocketAdapter, EventGateway, EventBridgeService, 'CHANGE_DETECTION_CONFIG']
    }
  ],
  exports: [
    BetApiService,
    BetApiLiveService,
    BetApiLineService,
    BetApiDetailedService,
    BetApiWebSocketAdapter,
    BetProcessingService,
    BetCalculationService,
  ]
})
export class BetApiModule {}
