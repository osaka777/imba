import { Injectable } from '@nestjs/common';

import { RedisService } from '~/shared/redis/redis.service';

const USER_COOLDOWN_MS = 45_000;
const CHANNEL_WINDOW_MS = 60_000;
const CHANNEL_MAX_REPLIES = 25;

@Injectable()
export class KickChatRateLimitService {
  private readonly userCooldowns = new Map<string, number>();
  private readonly channelBuckets = new Map<string, number[]>();

  constructor(private readonly redis: RedisService) {}

  async canReply(channelSlug: string, senderUserId: number) {
    const now = Date.now();
    const userKey = `kick:chat:user:${channelSlug}:${senderUserId}`;
    const channelKey = `kick:chat:channel:${channelSlug}`;

    if (this.redis.isAvailable()) {
      const lastUser = await this.redis.get(userKey);
      if (lastUser && now - Number(lastUser) < USER_COOLDOWN_MS) {
        return false;
      }

      const allowed = await this.redis.incrWithWindow(
        channelKey,
        CHANNEL_WINDOW_MS,
        CHANNEL_MAX_REPLIES,
      );
      if (!allowed) return false;

      await this.redis.set(userKey, String(now), USER_COOLDOWN_MS);
      return true;
    }

    const memUserKey = `${channelSlug}:${senderUserId}`;
    const lastUserReply = this.userCooldowns.get(memUserKey) ?? 0;
    if (now - lastUserReply < USER_COOLDOWN_MS) {
      return false;
    }

    const bucket = (this.channelBuckets.get(channelSlug) ?? []).filter(
      (ts) => now - ts < CHANNEL_WINDOW_MS,
    );
    if (bucket.length >= CHANNEL_MAX_REPLIES) {
      return false;
    }

    bucket.push(now);
    this.channelBuckets.set(channelSlug, bucket);
    this.userCooldowns.set(memUserKey, now);
    return true;
  }
}
