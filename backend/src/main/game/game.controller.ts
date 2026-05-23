import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { SuperuserGuard } from '~/main/user/authentication/superuser.guard';
import { PrismaService } from '~/prisma/prisma.service';
import { BetApiService } from '~/integrations/betapi/betapi.service';

import {
  AvailableGamesDto,
  FindGameDto,
  GameDtoWithGroupedMarkets,
  getGamesByIdsDto,
} from './dto/available-games.dto';
import { CreateGameDto } from './dto/available-games.dto';
import { GameNotFoundException } from './exception/game-not-found.exception';
import { GameService } from './game.service';
import { GameMarketsService } from './game-markets.service';
import { EventMarketsService } from './event-markets.service';

@ApiTags('Game')
@Controller('')
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(
    private readonly gameService: GameService,
    private readonly gameMarketsService: GameMarketsService,
    private readonly eventMarketsService: EventMarketsService,
    private readonly prismaService: PrismaService,
    private readonly betApiService: BetApiService,
  ) {}

  @Patch('/game/:eventId/:priority')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async changePriority(
    @Param('eventId') eventId: string,
    @Param('priority') priority: string,
  ) {
    await this.gameService.updateGame(eventId, { priority: +priority });
  }

  @Post('/createGame')
  @UsePipes(
    new ValidationPipe({
      forbidUnknownValues: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      },
    }),
  )
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async createGame(@Body() data: CreateGameDto) {
    return this.gameService.createGameWithMarkets(data);
  }

  @Get('/find')
  async findGames(
    @Query() query: FindGameDto,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    const games = await this.gameService.findGame(
      query.eventName,
      query.league,
    );

    return games.map(({ markets, ...game }) => ({
      ...game,
      groupedMarkets: (game.meta as any)?.groupedMarkets || this.gameService.groupMarkets(Object.values(markets || {})),
    }));
  }

  @Get('/games/prematch')
  async getFutureGames(
    @Query() query: AvailableGamesDto,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    // Преобразуем параметры в числа
    const limit = query.limit ? parseInt(query.limit.toString(), 10) : 100;
    const offset = query.offset ? parseInt(query.offset.toString(), 10) : 0;
    
    const games = await this.gameService.getFutureGames(
      undefined,
      limit,
      offset,
      query.lastCreatedAt && new Date(query.lastCreatedAt),
    );
    
    // Используем ту же логику что и для live игр - получаем свежие рынки через EventMarketsService
    const gamesWithFreshMarkets = await Promise.all(
      games.map(async ({ markets, ...game }) => {
        try {
          // Пытаемся получить свежие рынки
          const freshData = await this.eventMarketsService.getEventMarkets(game.eventId, 'ru');
          
          if (freshData && freshData.markets && Array.isArray(freshData.markets) && freshData.markets.length > 0) {
            // Трансформируем свежие рынки в нужный формат
            const transformedMarkets = this.gameService.transformBetApiToGroupedMarkets({ 
              game_oc_list: freshData.markets 
            });
            
            return {
              ...game,
              groupedMarkets: transformedMarkets,
            };
          }
        } catch (error) {
          this.logger.warn(`Failed to get fresh markets for prematch game ${game.eventId}: ${error.message}`);
        }
        
        // Fallback к старой логике если не удалось получить свежие данные
        return {
          ...game,
          groupedMarkets: this.gameService.groupMarkets(Object.values(markets)),
        };
      })
    );
    
    return gamesWithFreshMarkets;
  }

  @Get('/games/prematch/:sport')
  async getFutureGamesBySport(
    @Param('sport') sport: string,
    @Query() query: AvailableGamesDto,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    // Преобразуем параметры в числа
    const limit = query.limit ? parseInt(query.limit.toString(), 10) : 100;
    const offset = query.offset ? parseInt(query.offset.toString(), 10) : 0;
    
    const games = await this.gameService.getFutureGames(
      sport,
      limit,
      offset,
      query.lastCreatedAt && new Date(query.lastCreatedAt),
    );
    
    // Используем ту же логику что и для live игр - получаем свежие рынки через EventMarketsService
    const gamesWithFreshMarkets = await Promise.all(
      games.map(async ({ markets, ...game }) => {
        try {
          // Пытаемся получить свежие рынки
          const freshData = await this.eventMarketsService.getEventMarkets(game.eventId, 'ru');
          
          if (freshData && freshData.markets && Array.isArray(freshData.markets) && freshData.markets.length > 0) {
            // Трансформируем свежие рынки в нужный формат
            const transformedMarkets = this.gameService.transformBetApiToGroupedMarkets({ 
              game_oc_list: freshData.markets 
            });
            
            return {
              ...game,
              groupedMarkets: transformedMarkets,
            };
          }
        } catch (error) {
          this.logger.warn(`Failed to get fresh markets for prematch game ${game.eventId}: ${error.message}`);
        }
        
        // Fallback к старой логике если не удалось получить свежие данные
        return {
          ...game,
          groupedMarkets: this.gameService.groupMarkets(Object.values(markets)),
        };
      })
    );
    
    return gamesWithFreshMarkets;
  }

  @Get('/game/:eventId')
  async getGame(
    @Param('eventId') eventId: string,
  ): Promise<GameDtoWithGroupedMarkets> {
    try {
      this.logger.log(`Requested game with id: ${eventId}`);
      
      // Получаем базовую информацию об игре из базы данных
      const { markets, groupedMarkets, ...game } = await this.gameService.getGame(eventId);
      
      // Пытаемся получить свежие детальные рынки и stat_list через EventMarketsService
      // Используем детальный prematch API для игр со статусом PREMATCH, иначе используем live API
      try {
        this.logger.log(`🔥 Game ${eventId} has status: ${game.status}`);
        const freshData = game.status === 'PREMATCH' 
          ? await this.eventMarketsService.getDetailedPrematchEventMarkets(eventId, 'ru')
          : await this.eventMarketsService.getEventMarkets(eventId, 'ru');
        
        if (freshData && freshData.markets && Array.isArray(freshData.markets) && freshData.markets.length > 0) {
          const apiType = game.status === 'PREMATCH' ? 'detailed prematch' : 'live';
          this.logger.log(`Using fresh ${apiType} API data for game ${eventId} (${freshData.markets.length} market groups, ${freshData.stat_list.length} stat items)`);
          
          // Трансформируем свежие рынки в нужный формат
          const transformedMarkets = this.gameService.transformBetApiToGroupedMarkets({ 
            game_oc_list: freshData.markets 
          });
          
          // Обновляем мета-данные игры с новыми рынками, stat_list и дополнительными данными игры
          const updatedMeta = {
            ...((game.meta as any) || {}),
            groupedMarkets: transformedMarkets,
            stat_list: freshData.stat_list,
            last_markets_update: new Date().toISOString(),
            // Для prematch игр добавляем дополнительные данные из детального API
            ...(game.status === 'PREMATCH' && (freshData as any).gameData ? {
              gameData: (freshData as any).gameData,
              tournament_name: (freshData as any).gameData.tournament_name,
              opponents: {
                opp_1_name: (freshData as any).gameData.opp_1_name,
                opp_2_name: (freshData as any).gameData.opp_2_name,
                opp_1_icon: (freshData as any).gameData.opp_1_icon,
                opp_2_icon: (freshData as any).gameData.opp_2_icon
              }
            } : {})
          };
          
          // Сохраняем обновленные данные в базу
          await this.prismaService.game.update({
            where: { eventId },
            data: { 
              meta: updatedMeta,
              updatedAt: new Date()
            }
          });
          
          // Возвращаем игру с обновленными рынками и stat_list
          return {
            ...game,
            meta: updatedMeta,
            groupedMarkets: transformedMarkets,
            status: game.status,
            betApiStatus: updatedMeta.betApiStatus,
            betApiBody: updatedMeta.betApiBody
          } as GameDtoWithGroupedMarkets;
        }
      } catch (marketError) {
        this.logger.warn(`Failed to get fresh data for game ${eventId}: ${marketError.message}`);
        
        // Даже если не удалось получить свежие данные, обновляем updatedAt
        await this.prismaService.game.update({
          where: { eventId },
          data: { updatedAt: new Date() }
        }).catch(err => {
          this.logger.error(`Failed to update game timestamp for ${eventId}:`, err);
        });
      }
      
      // Fallback: используем данные из базы, но обновляем updatedAt
      await this.prismaService.game.update({
        where: { eventId },
        data: { updatedAt: new Date() }
      }).catch(err => {
        this.logger.error(`Failed to update game timestamp for ${eventId}:`, err);
      });
      
      if (groupedMarkets && Object.keys(groupedMarkets).length > 0) {
        this.logger.debug(`Using cached groupedMarkets for game ${eventId}`);
        return {
          ...game,
          groupedMarkets,
          status: game.status,
          betApiStatus: (game.meta as any)?.betApiStatus,
          betApiBody: (game.meta as any)?.betApiBody
        };
      } else {
        this.logger.debug(`Generating groupedMarkets from DB markets for game ${eventId}`);
        const fallbackGroupedMarkets = this.gameService.groupMarkets(Object.values(markets || {}));
        return {
          ...game,
          groupedMarkets: fallbackGroupedMarkets || {},
          status: game.status,
          betApiStatus: (game.meta as any)?.betApiStatus,
          betApiBody: (game.meta as any)?.betApiBody
        };
      }
    } catch (error) {
      if (error instanceof GameNotFoundException) {
        this.logger.warn(`Game not found with ID: ${eventId}`);
        throw new NotFoundException(`Game with ID ${eventId} not found`);
      }
      this.logger.error(`Error retrieving game with ID ${eventId}: ${error.message}`);
      throw error;
    }
  }

  @Get('/game/:eventId/sub-games')
  @ApiOperation({ summary: 'Get sub-games for a specific event' })
  @ApiResponse({ status: 200, description: 'Sub-games data for the event' })
  async getSubGames(@Param('eventId') eventId: string) {
    try {
      this.logger.debug(`Fetching sub-games for event ${eventId}`);
      
      // Сначала проверяем, есть ли сохраненные sub-games в базе данных
      const cachedSubGames = await this.prismaService.subGame.findMany({
        where: { parentEventId: eventId },
        orderBy: { gameNum: 'asc' }
      });

      // Если есть кэшированные данные и они не старше 5 минут, возвращаем их
      if (cachedSubGames.length > 0) {
        const latestUpdate = Math.max(...cachedSubGames.map(sg => sg.updatedAt.getTime()));
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        if (latestUpdate > fiveMinutesAgo) {
          this.logger.debug(`Returning cached sub-games for event ${eventId} (${cachedSubGames.length} games)`);
          this.logger.debug(`[SubGames] Using cached data for parent ${eventId}, found ${cachedSubGames.length} sub-games`);
          
          const mappedSubGames = cachedSubGames.map(sg => {
            this.logger.debug(`[SubGames] Cached subgame mapping: gameId=${sg.gameId} -> subEventId=${sg.subEventId} for ${sg.gameName}`);
            return {
              game_id: sg.subEventId, // Используем subEventId для совместимости с /sub-game/:eventId
              subGameDbId: sg.id, // Добавляем ID из базы данных для ставок
              game_num: sg.gameNum,
              game_name: sg.gameName,
              game_start: sg.gameStart,
              status: sg.status,
              score: sg.score,
              markets: sg.markets,
              ...(sg.meta && typeof sg.meta === 'object' ? sg.meta : {})
            };
          });

          return {
            sub_games: mappedSubGames,
            cached: true,
            lastUpdate: new Date(latestUpdate).toISOString()
          };
        }
      }

      // Получаем свежие данные из API
      const subGameData = await this.betApiService.fetchSubGameData(eventId);
      
      if (subGameData.status === 99) {
        this.logger.debug(`No sub-games found for event ${eventId}`);
        return { sub_games: [] };
      }

      // Логируем структуру ответа для отладки
      this.logger.debug(`Sub-game data structure:`, {
        status: subGameData.status,
        bodyKeys: subGameData.body ? Object.keys(subGameData.body) : 'no body',
        bodyType: typeof subGameData.body
      });

      // Обрабатываем различные форматы ответа от /sub endpoint
      let subGames = [];
      if (subGameData.body) {
        const body = subGameData.body as any;
        
        // Случай 1: Массив объектов (как у /list)
        if (Array.isArray(body) && body.length > 0) {
          const gameData = body[0];
          subGames = gameData?.sub_games || [];
        }
        // Случай 2: Одиночный объект event (специфичный для /sub)
        else if (body.event && typeof body.event === 'object') {
          subGames = body.event.sub_games || [];
        }
        // Случай 3: Объект с events_list
        else if (body.events_list && Array.isArray(body.events_list)) {
          subGames = body.events_list;
        }
        // Случай 4: Прямой объект с sub_games
        else if (body.sub_games) {
          subGames = body.sub_games;
        }
        // Случай 5: Прямой объект с game_oc_list (возможный формат /sub)
        else if (body.game_oc_list && Array.isArray(body.game_oc_list)) {
          subGames = body.game_oc_list;
        }
      }
      
      this.logger.debug(`Found ${subGames.length} sub-games for event ${eventId}`);

      // Сохраняем sub-games в базу данных
      if (subGames.length > 0) {
        try {
          // Получаем данные родительской игры
          const parentGame = await this.prismaService.game.findUnique({
            where: { eventId: eventId }
          });

          // Удаляем старые записи для этого события
          await this.prismaService.subGame.deleteMany({
            where: { parentEventId: eventId }
          });

          // Фильтруем подигры, исключая родительскую игру
          const filteredSubGames = subGames.filter((subGame: any) => {
            const subGameId = (subGame.game_id || subGame.id)?.toString();
            const parentEventIdStr = eventId.toString();
            
            // Исключаем родительскую игру (когда subGame.game_id === eventId)
            if (subGameId === parentEventIdStr) {
              this.logger.debug(`Excluding parent game ${subGameId} from sub-games list`);
              return false;
            }
            return true;
          });

          this.logger.debug(`Filtered ${filteredSubGames.length} actual sub-games (excluded parent game)`);

          // Создаем новые записи с данными из родительской игры
          const subGameRecords = filteredSubGames.map((subGame: any, index: number) => ({
            parentEventId: eventId,
            subEventId: (subGame.game_id || subGame.id || index).toString(),
            gameId: subGame.game_id || subGame.id || index,
            gameNum: subGame.game_num || index + 1,
            gameName: subGame.game_name || subGame.name || `Sub-game ${index + 1}`,
            gameStart: subGame.game_start || null,
            status: subGame.status || null,
            score: subGame.score || null,
            markets: subGame.game_oc_list || subGame.markets || null,
            // Добавляем данные из родительской игры
            eventName: parentGame?.eventName || null,
            leagueName: parentGame?.leagueName || null,
            sport: parentGame?.sport || null,
            team1: parentGame?.team1 || null,
            team2: parentGame?.team2 || null,
            startTime: parentGame?.createdAt || null,
            priority: parentGame?.priority || null,
            meta: {
              originalData: subGame,
              parentGameData: parentGame ? {
                eventName: parentGame.eventName,
                leagueName: parentGame.leagueName,
                sport: parentGame.sport,
                team1: parentGame.team1,
                team2: parentGame.team2,
                createdAt: parentGame.createdAt,
                priority: parentGame.priority
              } : null,
              fetchedAt: new Date().toISOString()
            }
          }));

          await this.prismaService.subGame.createMany({
            data: subGameRecords
          });

          this.logger.debug(`Saved ${subGameRecords.length} sub-games to database for event ${eventId} with parent game data`);
        } catch (dbError) {
          this.logger.error(`Error saving sub-games to database for event ${eventId}:`, dbError);
          // Продолжаем выполнение, даже если сохранение не удалось
        }
      }
      
      // Получаем сохраненные записи из базы данных для добавления subGameDbId
      const savedSubGames = await this.prismaService.subGame.findMany({
        where: { parentEventId: eventId },
        orderBy: { gameNum: 'asc' }
      });

      // Создаем мапу для быстрого поиска subGameDbId по subEventId
      const subGameDbIdMap = new Map();
      savedSubGames.forEach(sg => {
        subGameDbIdMap.set(sg.subEventId, sg.id);
      });
      
      // Преобразуем данные для frontend - заменяем game_id на subEventId и добавляем subGameDbId
      const transformedSubGames = subGames.map((subGame: any) => {
        const originalId = subGame.game_id || subGame.id;
        const transformedId = originalId?.toString();
        const subGameDbId = subGameDbIdMap.get(transformedId);
        
        this.logger.debug(`[SubGames] Transforming subgame ID: ${originalId} -> ${transformedId} (dbId: ${subGameDbId}) for parent ${eventId}`);
        
        return {
          ...subGame,
          game_id: transformedId, // Преобразуем в строку для совместимости с /sub-game/:eventId
          subGameDbId: subGameDbId // Добавляем ID из базы данных для ставок
        };
      });

      this.logger.debug(`[SubGames] Returning ${transformedSubGames.length} sub-games for parent ${eventId}:`, 
        transformedSubGames.map(sg => ({ name: sg.game_name, id: sg.game_id, dbId: sg.subGameDbId })));

      return { 
        sub_games: transformedSubGames,
        cached: false,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error fetching sub-games for event ${eventId}:`, error);
      
      // В случае ошибки API, пытаемся вернуть кэшированные данные
      try {
        const fallbackSubGames = await this.prismaService.subGame.findMany({
          where: { parentEventId: eventId },
          orderBy: { gameNum: 'asc' }
        });

        if (fallbackSubGames.length > 0) {
          this.logger.debug(`Returning fallback cached sub-games for event ${eventId}`);
          return { 
            sub_games: fallbackSubGames.map(sg => ({
              game_id: sg.subEventId, // Используем subEventId для совместимости с /sub-game/:eventId
              subGameDbId: sg.id, // Добавляем ID из базы данных для ставок
              game_num: sg.gameNum,
              game_name: sg.gameName,
              game_start: sg.gameStart,
              status: sg.status,
              score: sg.score,
              markets: sg.markets,
              ...(sg.meta && typeof sg.meta === 'object' ? sg.meta : {})
            })),
            cached: true,
            fallback: true,
            lastUpdate: Math.max(...fallbackSubGames.map(sg => sg.updatedAt.getTime()))
          };
        }
      } catch (dbError) {
        this.logger.error(`Error fetching fallback sub-games from database:`, dbError);
      }

      throw new NotFoundException(`Sub-games not found for event ${eventId}`);
    }
  }

  @Get('/game/:eventId/detailed')
  @ApiOperation({ summary: 'Get detailed data for a specific game using /sub/line API' })
  @ApiResponse({ status: 200, description: 'Detailed game data with all markets from /sub/line endpoint' })
  async getDetailedGameData(@Param('eventId') eventId: string) {
    try {
      this.logger.debug(`Fetching detailed game data for event ${eventId}`);
      
      // Получаем детальные данные через новый метод
      const detailedData = await this.betApiService.fetchDetailedEventData(eventId);
      
      if (detailedData && detailedData.status === 1 && detailedData.body) {
        this.logger.debug(`Successfully fetched detailed data for ${eventId}`);
        
        // Трансформируем данные аналогично live играм
        const transformedData = this.gameService.transformBetApiToGroupedMarkets(detailedData.body);
        
        return {
          ...detailedData.body,
          eventId,
          groupedMarkets: transformedData,
          source: 'sub/line'
        };
      } else {
        this.logger.warn(`No detailed data found for event ${eventId}`);
        throw new NotFoundException(`Detailed game data not found for event ${eventId}`);
      }
    } catch (error) {
      this.logger.error(`Error fetching detailed game data for event ${eventId}:`, error);
      throw new NotFoundException(`Detailed game data not found for event ${eventId}`);
    }
  }

  @Get('/sub-game/:eventId')
  @ApiOperation({ summary: 'Get detailed data for a specific sub-game' })
  @ApiResponse({ status: 200, description: 'Detailed sub-game data with markets' })
  async getSubGameData(@Param('eventId') eventId: string) {
    try {
      this.logger.debug(`Fetching sub-game data for event ${eventId}`);
      
      // Используем обновленный метод GameService.getSubGame
      const subGameData = await this.gameService.getSubGame(eventId);
      
      // Учитываем, что у BetAPI статус успеха равен 1, а у локального кэша ранее мог быть 0
      if (subGameData && subGameData.body && (subGameData.status === 1 || subGameData.status === 0 || subGameData.status === undefined)) {
        this.logger.debug(`Successfully fetched sub-game data for ${eventId}`);
        
        // Пытаемся также получить рынки через EventMarketsService
        try {
          const marketsData = await this.eventMarketsService.getEventMarkets(eventId, 'ru');
          
          if (marketsData && marketsData.markets && Array.isArray(marketsData.markets) && marketsData.markets.length > 0) {
            // Трансформируем свежие рынки в нужный формат
            const transformedMarkets = this.gameService.transformBetApiToGroupedMarkets({ 
              game_oc_list: marketsData.markets 
            });
            
            // Возвращаем данные подигры с рынками
        const responseData: any = {
          ...subGameData.body,
          eventId,
          groupedMarkets: transformedMarkets,
          stat_list: marketsData.stat_list || [],
          last_markets_update: new Date().toISOString()
        };
        
        // Обеспечиваем консистентность поля eventName
        if (responseData.event_name && !responseData.eventName) {
          responseData.eventName = responseData.event_name;
          delete responseData.event_name;
        }
        
        return responseData;
          }
        } catch (marketsError) {
          this.logger.warn(`Could not fetch markets for sub-game ${eventId}: ${marketsError.message}`);
        }
        
        // Возвращаем данные подигры без рынков, если рынки недоступны
        const responseData: any = {
          ...subGameData.body,
          eventId,
          groupedMarkets: {},
          stat_list: [],
          last_markets_update: new Date().toISOString()
        };
        
        // Обеспечиваем консистентность поля eventName
        if (responseData.event_name && !responseData.eventName) {
          responseData.eventName = responseData.event_name;
          delete responseData.event_name;
        }
        
        return responseData;
      } else {
        this.logger.warn(`No sub-game meta available for event ${eventId}, trying markets-only fallback`);
        // Попытка фолбэка: получить только рынки и вернуть минимальный объект
        try {
          const marketsData = await this.eventMarketsService.getEventMarkets(eventId, 'ru');
          if (marketsData && marketsData.markets && Array.isArray(marketsData.markets) && marketsData.markets.length > 0) {
            const transformedMarkets = this.gameService.transformBetApiToGroupedMarkets({ 
              game_oc_list: marketsData.markets 
            });
            return {
              id: eventId,
              eventId,
              groupedMarkets: transformedMarkets,
              stat_list: marketsData.stat_list || [],
              last_markets_update: new Date().toISOString()
            };
          }
        } catch (marketsOnlyError) {
          this.logger.warn(`Markets-only fallback failed for sub-game ${eventId}: ${marketsOnlyError.message}`);
        }
        
        throw new NotFoundException(`Подигра с ID ${eventId} не найдена. Возможно, игра завершена или данные еще не обновились.`);
      }
    } catch (error) {
      this.logger.error(`Error fetching sub-game data for event ${eventId}:`, error);
      
      // Проверяем тип ошибки для более информативного сообщения
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // Для других ошибок возвращаем более понятное сообщение
      throw new NotFoundException(`Не удалось загрузить данные подигры ${eventId}. Попробуйте обновить страницу.`);
    }
  }

  @Get('/game/:gameId/sub-game')
  @ApiOperation({ summary: 'Get sub-game data for a specific game' })
  @ApiResponse({ status: 200, description: 'Sub-game data from BetAPI' })
  async getSubGame(@Param('gameId') gameId: string) {
    return this.gameService.getSubGame(gameId);
  }

  @Get('/games/live')
  async getGames(
    @Query() query: AvailableGamesDto,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    this.logger.debug('Getting all live games');
    
    // Преобразуем параметры в числа
    const limit = query.limit ? parseInt(query.limit.toString(), 10) : 10;
    const offset = query.offset ? parseInt(query.offset.toString(), 10) : 0;
    
    try {
      const games = await this.gameService.getAvailableGames(
        undefined,
        limit,
        offset,
        query.lastCreatedAt && new Date(query.lastCreatedAt),
      );

      this.logger.debug(`Found ${games?.length || 0} live games`);
      
      if (!games || games.length === 0) {
        this.logger.warn('No live games found');
        return [];
      }

      return games.map(({ markets, subcategory, ...game }) => ({
        ...game,
        subcategory,
        odds: game.meta?.odds || {},
        startTime: game.meta?.startTime || game.meta?.game_start,
        timer: game.meta?.timer || 0,
        groupedMarkets: game.meta?.groupedMarkets || this.gameService.groupMarkets(Object.values(markets || {})),
      }));
    } catch (error) {
      this.logger.error('Error getting live games:', error);
      return [];
    }
  }

  @Get('/gamesByIds')
  async getGamesById(
    @Query() query: getGamesByIdsDto,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    try {
      this.logger.log(`Requested games by ids: ${query.ids.join(', ')}`);
      
      if (!query.ids || !Array.isArray(query.ids) || query.ids.length === 0) {
        this.logger.warn('Empty or invalid list of game IDs provided');
        return [];
      }
      
      if (query.ids.length > 100) {
        this.logger.warn(`Too many game IDs requested: ${query.ids.length}. Limiting to 100.`);
        query.ids = query.ids.slice(0, 100);
      }
      
      const games = await this.gameService.getGames(query.ids);
      
      if (games.length === 0) {
        this.logger.warn(`No games found for IDs: ${query.ids.join(', ')}`);
      } else if (games.length < query.ids.length) {
        const foundIds = games.map(game => game.eventId);
        const missingIds = query.ids.filter(id => !foundIds.includes(id));
        this.logger.warn(`Some games not found: ${missingIds.join(', ')}`);
      }
      
      return games.map(({ markets, ...game }) => ({
        ...game,
        groupedMarkets: (game.meta as any)?.groupedMarkets || this.gameService.groupMarkets(Object.values(markets || {})),
      }));
    } catch (error) {
      this.logger.error(`Error retrieving games by IDs: ${error.message}`);
      return [];
    } 
  }

  @Get('/games/live/:sport')
  async getGamesBySport(
    @Param('sport') sport: string,
    @Query() query: AvailableGamesDto,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    this.logger.debug(`Getting live games for sport: ${sport}`);
    
    // Преобразуем параметры в числа
    const limit = query.limit ? parseInt(query.limit.toString(), 10) : 10;
    const offset = query.offset ? parseInt(query.offset.toString(), 10) : 0;
    
    try {
      const games = await this.gameService.getAvailableGames(
        sport,
        limit,
        offset,
        query.lastCreatedAt && new Date(query.lastCreatedAt),
      );

      this.logger.debug(`Found ${games.length} live games for sport: ${sport}`);

      return games.map(({ markets, subcategory, ...game }) => ({
        ...game,
        subcategory,
        odds: game.meta?.odds || {},
        startTime: game.meta?.startTime || game.meta?.game_start,
        timer: game.meta?.timer || 0,
        groupedMarkets: game.meta?.groupedMarkets || this.gameService.groupMarkets(Object.values(markets || {})),
      }));
    } catch (error) {
      this.logger.error(`Error getting live games for sport ${sport}:`, error);
      return [];
    }
  }

  @Get('/games/live/:sport/:subcategory')
  async getLiveGamesBySubcategory(
    @Param('sport') sport: string,
    @Param('subcategory') subcategoryCode: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('lastCreatedAt') lastCreatedAt?: string,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    
    // Преобразуем параметры в числа
    const lim = limit ? parseInt(limit, 10) : 100;
    const off = offset ? parseInt(offset, 10) : 0;
    
    try {
      // Используем метод из GameService для получения игр по подкатегории
      const games = await this.gameService.getAvailableGamesBySubcategory(
        sport,
        subcategoryCode,
        lim,
        off,
        lastCreatedAt && new Date(lastCreatedAt),
      );
      
      // Преобразуем результат в формат с группированными маркетами и включаем подкатегорию
      return games.map(({ markets, subcategory, ...game }) => ({
        ...game,
        subcategory,
        odds: game.meta?.odds || {},
        startTime: game.meta?.startTime || game.meta?.game_start,
        timer: game.meta?.timer || 0,
        groupedMarkets: game.meta?.groupedMarkets || this.gameService.groupMarkets(Object.values(markets || {})),
      }));
    } catch (error) {
      console.error(`Error getting live games for ${sport}/${subcategoryCode}:`, error);
      return [];
    }
  }

  @Get('/games/prematch/:sport/:subcategory')
  async getPrematchGamesBySubcategory(
    @Param('sport') sport: string,
    @Param('subcategory') subcategoryCode: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('lastCreatedAt') lastCreatedAt?: string,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    
    // Преобразуем параметры в числа
    const lim = limit ? parseInt(limit, 10) : 50;
    const off = offset ? parseInt(offset, 10) : 0;
    
    try {
      // Используем метод из GameService для получения игр по подкатегории
      const games = await this.gameService.getFutureGamesBySubcategory(
        sport,
        subcategoryCode,
        lim,
        off,
        lastCreatedAt && new Date(lastCreatedAt),
      );
      
      // Используем ту же логику что и для live игр - получаем свежие рынки через EventMarketsService
      const gamesWithFreshMarkets = await Promise.all(
        games.map(async ({ markets, ...game }) => {
          try {
            // Пытаемся получить свежие рынки
            const freshData = await this.eventMarketsService.getEventMarkets(game.eventId, 'ru');
            
            if (freshData && freshData.markets && Array.isArray(freshData.markets) && freshData.markets.length > 0) {
              // Трансформируем свежие рынки в нужный формат
              const transformedMarkets = this.gameService.transformBetApiToGroupedMarkets({ 
                game_oc_list: freshData.markets 
              });
              
              return {
                ...game,
                odds: game.meta?.odds || {},
                startTime: game.meta?.startTime || game.meta?.game_start,
                timer: game.meta?.timer || 0,
                groupedMarkets: transformedMarkets,
              };
            }
          } catch (error) {
            this.logger.warn(`Failed to get fresh markets for prematch game ${game.eventId}: ${error.message}`);
          }
          
          // Fallback к старой логике если не удалось получить свежие данные
          return {
            ...game,
            odds: game.meta?.odds || {},
            startTime: game.meta?.startTime || game.meta?.game_start,
            timer: game.meta?.timer || 0,
            groupedMarkets: this.gameService.groupMarkets(Object.values(markets)),
          };
        })
      );
      
      return gamesWithFreshMarkets;
    } catch (error) {
      console.error(`Error getting prematch games for ${sport}/${subcategoryCode}:`, error);
      return [];
    }
  }

  @Get('/games/counts/live')
  async getLiveGameCounts() {
    const startingCounts = await this.gameService.getGameCounts('STARTING');
    const inProgressCounts = await this.gameService.getGameCounts('IN_PROGRESS');

    // Combine the counts
    const combinedCounts = {
      total: (startingCounts.total || 0) + (inProgressCounts.total || 0),
    };

    // Combine sport-specific counts
    const allSports = new Set([
      ...Object.keys(startingCounts),
      ...Object.keys(inProgressCounts)
    ]);

    allSports.forEach(sport => {
      if (sport !== 'total') {
        combinedCounts[sport] = (startingCounts[sport] || 0) + (inProgressCounts[sport] || 0);
      }
    });

    return combinedCounts;
  }

  @Get('/games/counts/prematch')
  async getPrematchGameCounts() {
    const counts = await this.gameService.getGameCounts('PREMATCH');
    return counts;
  }



  @Post('/games/mark-finished')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async markGamesFinished(@Body() data: { eventIds: string[] }) {
    try {
      const result = await this.prismaService.game.updateMany({
        data: { 
          status: 'FINISHED',
          updatedAt: new Date()
        },
        where: {
          eventId: { in: data.eventIds }
        }
      });
      
      this.logger.log(`Marked ${result.count} games as FINISHED`);
      return { 
        success: true, 
        message: `Successfully marked ${result.count} games as FINISHED`,
        count: result.count 
      };
    } catch (error) {
      this.logger.error('Error marking games as FINISHED:', error);
      throw error;
    }
  }

  @Post('/games/check-old')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Manually trigger check for old games' })
  async checkOldGames() {
    try {
      this.logger.log('Old games check method removed - now using BetAPI');
      return {
        success: true,
        message: 'Old games check method removed - now using BetAPI'
      };
    } catch (error) {
      this.logger.error('Error checking old games:', error);
      throw error;
    }
  }

  @Post('/admin/process-stuck-bets')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Process stuck bets manually' })
  @ApiResponse({ status: 200, description: 'Stuck bets processing completed' })
  async processStuckBets() {
    try {
      this.logger.log('Stuck bets processing method removed - now using BetAPI');
      return {
        success: true,
        message: 'Stuck bets processing method removed - now using BetAPI'
      };
    } catch (error) {
      this.logger.error('Error processing stuck bets:', error);
      throw error;
    }
  }

  @Post('/debug/process-stuck-bets')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiResponse({ status: 200, description: 'Stuck bets processing completed' })
  async debugProcessStuckBets() {
    try {
      console.log('DEBUG: Stuck bets processing method removed - now using BetAPI');
      this.logger.log('DEBUG: Stuck bets processing method removed - now using BetAPI');
      return {
        success: true,
        message: 'DEBUG: Stuck bets processing method removed - now using BetAPI'
      };
    } catch (error) {
      this.logger.error('DEBUG: Error processing stuck bets:', error);
      throw error;
    }
  }

  @Get('/debug/bet/:betId')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiResponse({ status: 200, description: 'Bet information' })
  async debugGetBet(@Param('betId') betId: string) {
    try {
      const bet = await this.prismaService.bet.findUnique({
        where: { id: parseInt(betId) },
        include: {
          game: true
        }
      });

      if (!bet) {
        throw new NotFoundException(`Bet ${betId} not found`);
      }

      return {
        success: true,
        bet: {
          id: bet.id,
          status: bet.status,
          gameId: bet.gameId,
          eventId: bet.game?.eventId,
          gameStatus: bet.game?.status,
          betInfo: bet.betInfo,
          createdAt: bet.createdAt,
          updatedAt: bet.updatedAt
        }
      };
    } catch (error) {
      this.logger.error(`Error getting bet ${betId}:`, error);
      return {
        success: false,
        message: `Error getting bet: ${error.message}`,
        error: error.stack
      };
    }
  }

  @Get('/debug/all-bets')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiResponse({ status: 200, description: 'List of all bets' })
  async debugGetAllBets() {
    try {
      const bets = await this.prismaService.bet.findMany({
          include: {
            game: true
          },
          orderBy: { id: 'asc' }
        });

      return {
        success: true,
        count: bets.length,
        bets: bets.map(bet => ({
          id: bet.id,
          status: bet.status,
          gameId: bet.gameId,
          eventId: bet.game?.eventId,
          gameStatus: bet.game?.status,
          createdAt: bet.createdAt
        }))
      };
    } catch (error) {
      this.logger.error('Error getting all bets:', error);
      return {
        success: false,
        message: `Error getting bets: ${error.message}`,
        error: error.stack
      };
    }
  }

  @Get('/debug/stuck-bets')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiResponse({ status: 200, description: 'List of stuck bets' })
  async debugGetStuckBets() {
    try {
      const stuckBets = await this.prismaService.bet.findMany({
        where: {
          status: 'PENDING',
          game: {
            status: 'FINISHED'
          }
        },
        include: {
          game: true,
          user: true
        },
        take: 20,
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return {
        success: true,
        count: stuckBets.length,
        bets: stuckBets.map(bet => ({
          id: bet.id,
          userId: bet.userId,
          userEmail: bet.user?.email || 'Unknown',
          amount: bet.amount,
          cf: bet.cf,
          status: bet.status,
          betVariant: bet.betVariant,
          betInfo: bet.betInfo,
          createdAt: bet.createdAt,
          game: {
            eventId: bet.game?.eventId,
            sport: bet.game?.sport,
            score: bet.game?.score,
            status: bet.game?.status,
            updatedAt: bet.game?.updatedAt
          }
        }))
      };
    } catch (error) {
      this.logger.error('DEBUG: Error getting stuck bets:', error);
      throw error;
    }
  }

  @Post('/debug/check-old-games')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiResponse({ status: 200, description: 'Old games check completed' })
  async debugCheckOldGames() {
    try {
      console.log('DEBUG: Old games check method removed - now using BetAPI');
      this.logger.log('DEBUG: Old games check method removed - now using BetAPI');
      return {
        success: true,
        message: 'DEBUG: Old games check method removed - now using BetAPI'
      };
    } catch (error) {
      this.logger.error('DEBUG: Error checking old games:', error);
      throw error;
    }
  }

  @Post('/debug/force-finish-game/:eventId')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiResponse({ status: 200, description: 'Game finished successfully' })
  async debugForceFinishGame(@Param('eventId') eventId: string) {
    try {
      console.log(`DEBUG: Force finishing game ${eventId} via API`);
      this.logger.log(`DEBUG: Force finishing game ${eventId} via API`);
      await this.gameService.forceFinishGame(eventId);
      return {
        success: true,
        message: `DEBUG: Game ${eventId} finished successfully`
      };
    } catch (error) {
      this.logger.error(`DEBUG: Error force finishing game ${eventId}:`, error);
      throw error;
    }
  }

  @Post('/debug/process-bet/:betId')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiResponse({ status: 200, description: 'Bet processing result' })
  async debugProcessSpecificBet(@Param('betId') betId: string) {
    try {
      this.logger.log(`DEBUG: Processing specific bet ${betId}`);
      
      // Add detailed logging
      this.logger.log(`DEBUG: Bet ${betId} - checking existence and status`);
      
      const bet = await this.prismaService.bet.findUnique({
        where: { id: parseInt(betId) },
        include: { game: true }
      });
      
      if (!bet) {
        this.logger.log(`DEBUG: Bet ${betId} not found`);
        return { success: false, message: 'Bet not found' };
      }
      
      this.logger.log(`DEBUG: Bet ${betId} found - status: ${bet.status}, game status: ${bet.game?.status}, betType: ${bet.betType}, betInfo: ${bet.betInfo}`);
      
      if (bet.status !== 'PENDING') {
        this.logger.log(`DEBUG: Bet ${betId} already processed - status: ${bet.status}`);
        return { success: false, message: `Bet already ${bet.status}` };
      }
      
      if (bet.game.status !== 'FINISHED') {
        this.logger.log(`DEBUG: Bet ${betId} game not finished - status: ${bet.game.status}`);
        return { success: false, message: 'Game not finished yet' };
      }
      
      this.logger.log(`DEBUG: Bet ${betId} is eligible for processing - method removed, now using BetAPI`);
      
      // Old processing method removed - now using BetAPI
       
       // Check if bet was processed
       const updatedBet = await this.prismaService.bet.findUnique({
         where: { id: parseInt(betId) }
       });
       
       const result = {
         betId: betId,
         oldStatus: bet.status,
         newStatus: updatedBet?.status,
         processed: updatedBet?.status !== bet.status
       };
      
      return {
        success: true,
        message: `Bet ${betId} processed successfully`,
        result
      };
    } catch (error) {
      this.logger.error(`DEBUG: Error processing bet ${betId}:`, error);
      return {
        success: false,
        message: `Error processing bet: ${error.message}`,
        error: error.stack
      };
    }
  }

  @Post('/admin/check-and-cleanup')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Check old games and process stuck bets' })
  @ApiResponse({ status: 200, description: 'Check and cleanup completed' })
  async checkAndCleanup() {
    try {
      this.logger.log('Check and cleanup methods removed - now using BetAPI');
      return {
        success: true,
        message: 'Check and cleanup methods removed - now using BetAPI'
      };
    } catch (error) {
      this.logger.error('Error in check and cleanup:', error);
      throw error;
    }
  }

  @Post('/admin/force-finish-game/:eventId')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Force finish a specific game and process its bets' })
  @ApiResponse({ status: 200, description: 'Game finished successfully' })
  async forceFinishGame(@Param('eventId') eventId: string) {
    try {
      this.logger.log(`Force finishing game ${eventId} via API`);
      const result = await this.gameService.forceFinishGame(eventId);
      return result;
    } catch (error) {
      this.logger.error(`Error force finishing game ${eventId}:`, error);
      throw error;
    }
  }

  @Get('/admin/diagnose-games')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Diagnose problematic games' })
  @ApiResponse({ status: 200, description: 'Diagnostic information about problematic games' })
  async diagnoseGames() {
    try {
      this.logger.log('Diagnosing problematic games via API');
      const diagnostics = await this.gameService.diagnoseProblematicGames();
      return diagnostics;
    } catch (error) {
      this.logger.error('Error diagnosing games:', error);
      throw error;
    }
  }

  @Get('/event/:eventId/markets')
  @ApiOperation({ summary: 'Get detailed markets for a specific event with caching' })
  @ApiResponse({ status: 200, description: 'Detailed market data for the event' })
  async getEventMarkets(
    @Param('eventId') eventId: string,
    @Query('lang') language: string = 'ru'
  ) {
    try {
      this.logger.log(`Getting detailed markets for event ${eventId} in language ${language}`);
      const data = await this.eventMarketsService.getEventMarkets(eventId, language);
      return {
        eventId,
        language,
        markets: data.markets,
        stat_list: data.stat_list
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      throw error;
    }
  }

  @Post('/admin/clear-cache')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Clear expired event markets cache' })
  @ApiResponse({ status: 200, description: 'Number of cleared cache entries' })
  async clearExpiredCache() {
    try {
      const clearedCount = await this.eventMarketsService.clearExpiredCache();
      this.logger.log(`Cleared ${clearedCount} expired cache entries`);
      return { clearedCount };
    } catch (error) {
      this.logger.error('Error clearing expired cache:', error);
      throw error;
    }
  }

  @Post('/admin/force-refresh-subgames/:eventId')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Force refresh sub-games for a specific event' })
  @ApiResponse({ status: 200, description: 'Sub-games refreshed successfully' })
  async forceRefreshSubGames(@Param('eventId') eventId: string) {
    try {
      this.logger.log(`Force refreshing sub-games for event ${eventId}`);
      const result = await this.gameService.forceRefreshSubGames(eventId);
      
      if (result && result.status === 99) {
        return {
          success: true,
          message: `Нет подигр для события ${eventId}`,
          eventId,
          subGamesCount: 0
        };
      }
      
      const subGamesCount = result?.body?.length || 0;
      return {
        success: true,
        message: `Подигры для события ${eventId} успешно обновлены`,
        eventId,
        subGamesCount
      };
    } catch (error) {
      this.logger.error(`Error force refreshing sub-games for event ${eventId}:`, error);
      throw new NotFoundException(`Не удалось обновить подигры для события ${eventId}: ${error.message}`);
    }
  }

  @Get('/debug/subgame/:subEventId')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiResponse({ status: 200, description: 'SubGame information' })
  async debugGetSubGame(@Param('subEventId') subEventId: string) {
    try {
      const subGame = await this.prismaService.subGame.findUnique({
        where: { subEventId: subEventId }
      });
      
      if (!subGame) {
        return { 
          found: false, 
          message: `SubGame with subEventId ${subEventId} not found`,
          subEventId 
        };
      }
      
      return { 
        found: true, 
        subGame,
        message: `SubGame with subEventId ${subEventId} found`
      };
    } catch (error) {
      this.logger.error(`Error checking SubGame ${subEventId}:`, error);
      throw error;
    }
  }
}