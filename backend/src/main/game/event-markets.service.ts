import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { PrismaService } from '~/prisma/prisma.service';
import { BetApiService } from '~/integrations/betapi/betapi.service';

@Injectable()
export class EventMarketsService {
  private readonly TTL_SECONDS = 3; // 3 seconds cache TTL to smooth transient BetAPI rebuilds
  private readonly EMPTY_GRACE_SECONDS = 8; // serve last non-empty markets for up to 8s when API returns empty

  constructor(
    private readonly prisma: PrismaService,
    private readonly betApiService: BetApiService,
    @Inject('winston') private readonly logger: Logger,
  ) {}

  /**
   * Get detailed markets and stat_list for an event with caching
   * If cache is fresh (< TTL_SECONDS), return cached data
   * Otherwise, fetch fresh data from API and update cache
   */
  async getEventMarkets(eventId: string, language: string = 'ru'): Promise<{markets: any, stat_list: any[]}> {
    try {
      // Check if we have cached data
      const cachedMarkets = await this.prisma.eventMarkets.findUnique({
        where: { eventId }
      });

      const now = new Date();
      const isExpired = !cachedMarkets || 
        (now.getTime() - cachedMarkets.updatedAt.getTime()) > (this.TTL_SECONDS * 1000);

      if (!isExpired && cachedMarkets) {
        this.logger.debug(`Returning cached markets for event ${eventId}`);
        const cached = cachedMarkets.markets as any;
        return {
          markets: cached.markets || cached,
          stat_list: cached.stat_list || []
        };
      }

      const freshData = await this.fetchFromBetApi(eventId, language);

      // If API responded with empty markets, avoid overwriting cache and prefer serving cached (any age)
      if (freshData && Array.isArray(freshData.markets) && freshData.markets.length === 0) {
        if (cachedMarkets) {
          this.logger.debug(`API returned EMPTY markets for event ${eventId}; serving cached and skipping upsert to avoid cache wipe`);
          const cached = cachedMarkets.markets as any;
          return {
            markets: cached.markets || cached,
            stat_list: cached.stat_list || []
          };
        }
        // No cache exists: return empty to client but DO NOT upsert empties
        this.logger.debug(`API returned EMPTY markets for event ${eventId} and no cache exists; returning empty without persisting`);
        return freshData;
      }

      // If API responded but returned empty markets, prefer serving recent cached data to avoid UI flicker
      if (freshData && Array.isArray(freshData.markets) && freshData.markets.length === 0 && cachedMarkets) {
        const ageMs = now.getTime() - cachedMarkets.updatedAt.getTime();
        if (ageMs <= this.EMPTY_GRACE_SECONDS * 1000) {
          this.logger.debug(`API returned empty markets for event ${eventId}; serving cached due to ${this.EMPTY_GRACE_SECONDS}s grace window`);
          const cached = cachedMarkets.markets as any;
          return {
            markets: cached.markets || cached,
            stat_list: cached.stat_list || []
          };
        }
      }

      if (freshData) {
        try {
          // Update or create cache entry (only with non-empty markets)
          await this.prisma.eventMarkets.upsert({
            where: { eventId },
            create: {
              eventId,
              markets: freshData,
            },
            update: {
              markets: freshData,
              updatedAt: now,
            },
          });
        } catch (error) {
          // Handle foreign key constraint error
          if (error.code === 'P2003') {
            this.logger.warn(`Game record not found for event ${eventId}, fetching event data from BetAPI`);
            
            try {
              // Fetch event data from BetAPI to get real information
              const eventResponse = await this.betApiService['fetchEventData'](eventId);
              
              if (eventResponse && eventResponse.status === 1 && eventResponse.body) {
                const eventData = eventResponse.body;
                
                // Create Game record with real data from BetAPI
                await this.prisma.game.upsert({
                  where: { eventId },
                  create: {
                    eventId,
                    eventName: `${eventData.opp_1_name || 'Team 1'} vs ${eventData.opp_2_name || 'Team 2'}`,
                    team1: eventData.opp_1_name || 'Team 1',
                    team2: eventData.opp_2_name || 'Team 2',
                    sport: eventData.sport_name?.toLowerCase() || 'football',
                    leagueName: eventData.tournament_name || 'Unknown League',
                    status: 'IN_PROGRESS',
                    score: eventData.score_full || '',
                    priority: eventData.priority || 0,
                  },
                  update: {}, // Don't update existing records
                });
                
                this.logger.info(`Created Game record with real data for event ${eventId}: ${eventData.opp_1_name} vs ${eventData.opp_2_name}`);
              } else {
                // Fallback to minimal record if BetAPI fails
                this.logger.warn(`Failed to fetch event data from BetAPI for ${eventId}, using minimal record`);
                await this.prisma.game.upsert({
                  where: { eventId },
                  create: {
                    eventId,
                    eventName: `Event ${eventId}`,
                    team1: 'Team 1',
                    team2: 'Team 2',
                    sport: 'football',
                    leagueName: 'Unknown League',
                    status: 'IN_PROGRESS',
                    score: '',
                    priority: 0,
                  },
                  update: {}, // Don't update existing records
                });
              }
            } catch (fetchError) {
              this.logger.error(`Error fetching event data from BetAPI for ${eventId}:`, fetchError.message);
              
              // Fallback to minimal record
              await this.prisma.game.upsert({
                where: { eventId },
                create: {
                  eventId,
                  eventName: `Event ${eventId}`,
                  team1: 'Team 1',
                  team2: 'Team 2',
                  sport: 'football',
                  leagueName: 'Unknown League',
                  status: 'IN_PROGRESS',
                  score: '',
                  priority: 0,
                },
                update: {}, // Don't update existing records
              });
            }

            // Now try to create the EventMarkets record again
            await this.prisma.eventMarkets.upsert({
              where: { eventId },
              create: {
                eventId,
                markets: freshData,
              },
              update: {
                markets: freshData,
                updatedAt: now,
              },
            });
          } else {
            throw error;
          }
        }

        this.logger.debug(`Updated cached markets for event ${eventId}`);
        return freshData;
      }

      // If API failed but we have stale cache, return it
      if (cachedMarkets) {
        this.logger.warn(`API failed for event ${eventId}, returning stale cache`);
        const cached = cachedMarkets.markets as any;
        return {
          markets: cached.markets || cached,
          stat_list: cached.stat_list || []
        };
      }

      // No cache and API failed
      throw new Error(`Unable to fetch markets for event ${eventId}`);

    } catch (error) {
      this.logger.error(`Error getting markets for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get prematch markets and stat_list for an event
   * Uses the /sub/line endpoint for prematch data
   */
  async getPrematchEventMarkets(eventId: string, language: string = 'ru'): Promise<{markets: any, stat_list: any[]}> {
    try {
      this.logger.debug(`Fetching prematch markets for event ${eventId}`);
      
      const freshData = await this.fetchFromPrematchApi(eventId, language);
      
      if (freshData) {
        this.logger.debug(`Successfully fetched prematch markets for event ${eventId}`);
        return freshData;
      }
      
      // No data available
      throw new Error(`Unable to fetch prematch markets for event ${eventId}`);
      
    } catch (error) {
      this.logger.error(`Error getting prematch markets for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed prematch markets for a single event page with comprehensive market data
   * Uses the detailed /event/{eventId}/sub/line/{language} endpoint for individual game pages
   */
  async getDetailedPrematchEventMarkets(eventId: string, language: string = 'ru'): Promise<{markets: any, stat_list: any[], gameData: any}> {
    try {
      this.logger.info(`🔥 DETAILED PREMATCH API CALLED for event ${eventId}`);
      
      const freshData = await this.fetchFromDetailedPrematchApi(eventId, language);
      
      if (freshData) {
        this.logger.info(`🔥 DETAILED PREMATCH API SUCCESS for event ${eventId} - got ${freshData.markets?.length || 0} markets`);
        return freshData;
      }
      
      // No data available
      throw new Error(`Unable to fetch detailed prematch markets for event ${eventId}`);
      
    } catch (error) {
      this.logger.error(`Error getting detailed prematch markets for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch detailed markets and stat_list from BetAPI using the /sub endpoint directly
   * Tries both 'line' and 'live' data types to get the best available data
   */
  private async fetchFromBetApi(eventId: string, language: string = 'ru'): Promise<{markets: any, stat_list: any[]} | null> {
    try {
      this.logger.debug(`Fetching markets from BetAPI /sub endpoint for event ${eventId}`);
      
      // Try 'line' type first (usually has more markets)
      let response = await this.betApiService['request'](`/event/${eventId}/sub`, 'line', language);
      let dataType = 'line';

      // If line response is empty or invalid, try 'live' type
      if (!response || response.status !== 1 || !response.body || !response.body.game_oc_list || response.body.game_oc_list.length === 0) {
        this.logger.debug(`Line data empty or invalid for event ${eventId}, trying live data`);
        response = await this.betApiService['request'](`/event/${eventId}/sub`, 'live', language);
        dataType = 'live';
      }

      // Handle the BetAPI response structure from /sub endpoint: body.game_oc_list and body.stat_list
      if (response && response.status === 1 && response.body) {
        const markets = response.body.game_oc_list || [];
        const stat_list = response.body.stat_list || [];
        
        this.logger.debug(`Successfully fetched data from BetAPI /sub endpoint for event ${eventId} using ${dataType} type`, {
          marketGroups: markets.length,
          statItems: stat_list.length,
          dataType
        });
        
        // Логируем stat_list если есть
        if (stat_list.length > 0) {
          this.logger.debug(`Event ${eventId} has stat_list with ${stat_list.length} items`, {
            sampleStats: stat_list.slice(0, 2)
          });
        }
        
        return {
          markets,
          stat_list
        };
      }
      
      this.logger.warn(`Invalid or empty response structure from BetAPI /sub endpoint for event ${eventId} (tried both line and live):`, {
        status: response?.status,
        hasBody: !!response?.body,
        hasGameOcList: !!response?.body?.game_oc_list
      });
      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch from BetAPI /sub endpoint for event ${eventId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch prematch markets from BetAPI /sub/line endpoint
   * Tries both 'line' and 'live' data types to get the best available data
   */
  private async fetchFromPrematchApi(eventId: string, language: string = 'ru'): Promise<{markets: any, stat_list: any[]} | null> {
    try {
      this.logger.debug(`Fetching prematch markets from BetAPI /sub/line endpoint for event ${eventId}`);
      
      // Try 'line' type first (preferred for prematch)
      let response = await this.betApiService['request'](`/event/${eventId}/sub/line`, 'line', language);
      let dataType = 'line';

      // If line response is empty or invalid, try 'live' type
      if (!response || response.status !== 1 || !response.body || !response.body.game_oc_list || response.body.game_oc_list.length === 0) {
        this.logger.debug(`Line data empty or invalid for event ${eventId}, trying live data`);
        response = await this.betApiService['request'](`/event/${eventId}/sub/line`, 'live', language);
        dataType = 'live';
      }

      // Handle the BetAPI response structure from /sub/line endpoint: body.game_oc_list and body.stat_list
      if (response && response.status === 1 && response.body) {
        const markets = response.body.game_oc_list || [];
        const stat_list = response.body.stat_list || [];
        
        this.logger.debug(`Successfully fetched prematch data from BetAPI /sub/line endpoint for event ${eventId} using ${dataType} type`, {
          marketGroups: markets.length,
          statItems: stat_list.length,
          dataType
        });
        
        // Логируем stat_list если есть
        if (stat_list.length > 0) {
          this.logger.debug(`Event ${eventId} has prematch stat_list with ${stat_list.length} items`, {
            sampleStats: stat_list.slice(0, 2)
          });
        }
        
        return {
          markets,
          stat_list
        };
      }
      
      this.logger.warn(`Invalid or empty response structure from BetAPI /sub/line endpoint for event ${eventId} (tried both line and live):`, {
        status: response?.status,
        hasBody: !!response?.body,
        hasGameOcList: !!response?.body?.game_oc_list
      });
      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch from BetAPI /sub/line endpoint for event ${eventId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch detailed prematch markets from BetAPI /event/{eventId}/sub/line/{language} endpoint
   * This endpoint provides comprehensive market data for individual game pages
   * Tries both 'line' and 'live' data types to maximize data availability
   */
  private async fetchFromDetailedPrematchApi(eventId: string, language: string = 'ru'): Promise<{markets: any, stat_list: any[], gameData: any} | null> {
    // Try 'line' type first
    try {
      this.logger.debug(`Fetching detailed prematch markets from BetAPI /event/${eventId}/sub/line/${language} endpoint for event ${eventId} with type 'line'`);
      
      // Use the BetApiService's request method directly with detailed endpoint and 'line' type
      const lineResponse = await this.betApiService['request'](`/event/${eventId}/sub/line/${language}`, 'line', language);

      // Handle the BetAPI response structure from detailed endpoint: body.game_oc_list and body.stat_list
      if (lineResponse && lineResponse.status === 1 && lineResponse.body) {
        const markets = lineResponse.body.game_oc_list || [];
        const stat_list = lineResponse.body.stat_list || [];
        const gameData = lineResponse.body; // Full game data including tournament info, opponents, etc.
        
        // Check if we have valid data
        if (markets.length > 0 || stat_list.length > 0) {
          this.logger.debug(`Successfully fetched detailed prematch data from BetAPI for event ${eventId} with type 'line'`, {
            marketGroups: markets.length,
            statItems: stat_list.length,
            hasGameData: !!gameData,
            tournamentName: gameData.tournament_name,
            opponents: `${gameData.opp_1_name} vs ${gameData.opp_2_name}`
          });
          
          // Логируем stat_list если есть
          if (stat_list.length > 0) {
            this.logger.debug(`Event ${eventId} has detailed prematch stat_list with ${stat_list.length} items`, {
              sampleStats: stat_list.slice(0, 2)
            });
          }
          
          return {
            markets,
            stat_list,
            gameData
          };
        }
        
        this.logger.debug(`Line type returned empty data for event ${eventId}, trying live type`);
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch from detailed BetAPI endpoint with 'line' type for event ${eventId}:`, error.message);
    }

    // Try 'live' type as fallback
    try {
      this.logger.debug(`Fetching detailed prematch markets from BetAPI /event/${eventId}/sub/line/${language} endpoint for event ${eventId} with type 'live'`);
      
      // Use the BetApiService's request method directly with detailed endpoint and 'live' type
      const liveResponse = await this.betApiService['request'](`/event/${eventId}/sub/line/${language}`, 'live', language);

      // Handle the BetAPI response structure from detailed endpoint: body.game_oc_list and body.stat_list
      if (liveResponse && liveResponse.status === 1 && liveResponse.body) {
        const markets = liveResponse.body.game_oc_list || [];
        const stat_list = liveResponse.body.stat_list || [];
        const gameData = liveResponse.body; // Full game data including tournament info, opponents, etc.
        
        this.logger.debug(`Successfully fetched detailed prematch data from BetAPI for event ${eventId} with type 'live'`, {
          marketGroups: markets.length,
          statItems: stat_list.length,
          hasGameData: !!gameData,
          tournamentName: gameData.tournament_name,
          opponents: `${gameData.opp_1_name} vs ${gameData.opp_2_name}`
        });
        
        // Логируем stat_list если есть
        if (stat_list.length > 0) {
          this.logger.debug(`Event ${eventId} has detailed prematch stat_list with ${stat_list.length} items`, {
            sampleStats: stat_list.slice(0, 2)
          });
        }
        
        return {
          markets,
          stat_list,
          gameData
        };
      }
      
      this.logger.warn(`Invalid or empty response structure from detailed BetAPI endpoint for event ${eventId} with 'live' type:`, {
        status: liveResponse?.status,
        hasBody: !!liveResponse?.body,
        hasGameOcList: !!liveResponse?.body?.game_oc_list
      });
      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch from detailed BetAPI endpoint with 'live' type for event ${eventId}:`, error.message);
      return null;
    }
  }

  /**
   * Clear expired cache entries
   * Should be called periodically to clean up old data
   */
  async clearExpiredCache(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - (2 * 60 * 1000)); // 2 minutes ago
      
      const result = await this.prisma.eventMarkets.deleteMany({
        where: {
          updatedAt: {
            lt: cutoffTime
          }
        }
      });

      if (result.count > 0) {
        this.logger.info(`Cleared ${result.count} expired event market cache entries`);
      }

      return result.count;
    } catch (error) {
      this.logger.error('Error clearing expired cache:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache for specific event
   */
  async invalidateEventCache(eventId: string): Promise<void> {
    try {
      await this.prisma.eventMarkets.delete({
        where: { eventId }
      });
      this.logger.debug(`Invalidated cache for event ${eventId}`);
    } catch (error) {
      // Ignore if cache entry doesn't exist
      if (error.code !== 'P2025') {
        this.logger.error(`Error invalidating cache for event ${eventId}:`, error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    freshEntries: number;
    staleEntries: number;
  }> {
    try {
      const now = new Date();
      const ttlCutoff = new Date(now.getTime() - (this.TTL_SECONDS * 1000));

      const [totalEntries, freshEntries] = await Promise.all([
        this.prisma.eventMarkets.count(),
        this.prisma.eventMarkets.count({
          where: {
            updatedAt: {
              gte: ttlCutoff
            }
          }
        })
      ]);

      return {
        totalEntries,
        freshEntries,
        staleEntries: totalEntries - freshEntries,
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return { totalEntries: 0, freshEntries: 0, staleEntries: 0 };
    }
  }
}
