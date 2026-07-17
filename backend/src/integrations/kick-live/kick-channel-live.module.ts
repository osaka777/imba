import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EsportsStreamResolverService } from './esports-stream-resolver.service';
import { KickChannelLiveService } from './kick-channel-live.service';
import { TwitchChannelLiveService } from './twitch-channel-live.service';

@Module({
  imports: [ConfigModule],
  providers: [
    KickChannelLiveService,
    TwitchChannelLiveService,
    EsportsStreamResolverService,
  ],
  exports: [
    KickChannelLiveService,
    TwitchChannelLiveService,
    EsportsStreamResolverService,
  ],
})
export class KickChannelLiveModule {}
