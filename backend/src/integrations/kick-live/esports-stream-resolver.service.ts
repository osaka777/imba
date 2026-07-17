import { Injectable } from '@nestjs/common';

import { KickChannelLiveService } from './kick-channel-live.service';
import { TwitchChannelLiveService } from './twitch-channel-live.service';
import {
  kickEsportsLiveProbeSlugs,
  resolveKickBroadcastChannel,
  type KickBroadcastContext,
} from '../wc-odds/kick-broadcast.util';
import { twitchEsportsEnProbeSlugs } from '../wc-odds/twitch-en-broadcast.util';

export type EsportsLiveStreamPick = {
  provider: 'kick' | 'twitch';
  channel: string;
  isFallback: boolean;
};

@Injectable()
export class EsportsStreamResolverService {
  constructor(
    private readonly kickLive: KickChannelLiveService,
    private readonly twitchLive: TwitchChannelLiveService,
  ) {}

  async resolveLiveStream(
    sportKey: string | null | undefined,
    kickCtx?: KickBroadcastContext,
  ): Promise<EsportsLiveStreamPick | null> {
    const mappedKick = kickCtx ? resolveKickBroadcastChannel(kickCtx) : null;
    const kickCandidates = [
      ...(mappedKick ? [mappedKick] : []),
      ...kickEsportsLiveProbeSlugs(sportKey),
    ];

    const kickLive = await this.kickLive.findFirstLiveChannel(kickCandidates);
    if (kickLive) {
      return {
        provider: 'kick',
        channel: kickLive,
        isFallback: mappedKick !== kickLive,
      };
    }

    const twitchLive = await this.twitchLive.findFirstLiveChannel(
      twitchEsportsEnProbeSlugs(sportKey),
    );
    if (twitchLive) {
      return {
        provider: 'twitch',
        channel: twitchLive,
        isFallback: true,
      };
    }

    return null;
  }
}
