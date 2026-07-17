import { Module, forwardRef } from '@nestjs/common';

import { TelegramModule } from '~/main/telegram/telegram.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { KickConnectBonusModule } from './kick-connect-bonus.module';
import { KickWidgetAlertService } from './kick-widget-alert.service';
import { KickChatAnnounceService } from './kick-chat-announce.service';
import { KickLiveTrafficNotifyService } from './kick-live-traffic-notify.service';
import { KickStreamRaceModule } from './kick-stream-race.module';
import { KickTokenModule } from './kick-token.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => TelegramModule),
    KickConnectBonusModule,
    KickStreamRaceModule,
    KickTokenModule,
  ],
  providers: [KickLiveTrafficNotifyService, KickWidgetAlertService, KickChatAnnounceService],
  exports: [KickLiveTrafficNotifyService, KickWidgetAlertService, KickChatAnnounceService],
})
export class KickLiveNotifyModule {}
