import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '~/prisma/prisma.service';
import { BetApiService } from '~/integrations/betapi/betapi.service';
import { BetApiTransformService } from '~/integrations/betapi/betapi-transform.service';

@Injectable()
export class GameMarketsService {
  private readonly logger = new Logger(GameMarketsService.name);
  private readonly CACHE_TTL_MS = 30000; // 30 seconds

  constructor(
    private readonly prismaService: PrismaService,
    private readonly betApiService: BetApiService,
  ) {}

  /**
   * Get detailed markets for a game with TTL-based caching
   */
  async getGameMarkets(eventId: string): Promise<any[]> {
    try {
      // 1. Check cache first
      const cached = await this.prismaService.gameMarkets.findUnique({
        where: { eventId },
        select: { markets: true, updatedAt: true }
      });

      // 2. If cache is fresh (< 30 seconds), return cached data
      if (cached && this.isCacheFresh(cached.updatedAt)) {
        this.logger.debug(`Using cached markets for game ${eventId}`);
        return cached.markets as any[];
      }

      // 3. Cache is stale or missing - fetch from API
      const apiResponse = await this.betApiService.fetchEventData(eventId);
      
      if (!apiResponse || !apiResponse.body) {
        this.logger.warn(`No data received from API for game ${eventId}`);
        return cached?.markets as any[] || [];
      }

      // 4. Process the markets data
      const markets = BetApiTransformService.PrepareOsList(apiResponse.body);

      // 5. Update cache
      await this.prismaService.gameMarkets.upsert({
        where: { eventId },
        create: { 
          eventId, 
          markets: markets as any 
        },
        update: { 
          markets: markets as any,
          updatedAt: new Date() 
        }
      });

      this.logger.debug(`Updated markets cache for game ${eventId}, found ${markets.length} bets`);
      return markets;

    } catch (error) {
      this.logger.error(`Error getting markets for game ${eventId}:`, error);
      
      // Fallback to cached data if available
      const fallback = await this.prismaService.gameMarkets.findUnique({
        where: { eventId },
        select: { markets: true }
      });
      
      return fallback?.markets as any[] || [];
    }
  }

  /**
   * Check if cached data is still fresh
   */
  private isCacheFresh(updatedAt: Date): boolean {
    const now = Date.now();
    const cacheAge = now - updatedAt.getTime();
    return cacheAge < this.CACHE_TTL_MS;
  }

  /**
   * Clear stale cache entries (can be called periodically)
   */
  async clearStaleCache(): Promise<void> {
    const staleThreshold = new Date(Date.now() - this.CACHE_TTL_MS * 10); // 5 minutes old
    
    try {
      const result = await this.prismaService.gameMarkets.deleteMany({
        where: {
          updatedAt: {
            lt: staleThreshold
          }
        }
      });
      
      if (result.count > 0) {
        this.logger.debug(`Cleared ${result.count} stale market cache entries`);
      }
    } catch (error) {
      this.logger.error('Error clearing stale cache:', error);
    }
  }

  /**
   * Force refresh markets for a specific game
   */
  async refreshGameMarkets(eventId: string): Promise<any[]> {
    // Delete existing cache to force refresh
    await this.prismaService.gameMarkets.delete({
      where: { eventId }
    }).catch(() => {}); // Ignore if not exists

    return this.getGameMarkets(eventId);
  }
}
