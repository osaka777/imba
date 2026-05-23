import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '~/prisma/prisma.service';
import { BetStatus, OperationStatus } from '@prisma/client';
import { OperationService } from '~/main/operation/operation.service';
import { EventGateway } from '~/main/event/event.gateway';
import { Decimal } from '@prisma/client/runtime/library';
import axios, { AxiosInstance } from 'axios';
import { BetPlaceResponse } from '~/integrations/betapi/types/bet-place-response';
import { LanguageService } from '~/shared/services/language.service';
import * as crypto from 'crypto';


@Injectable()
export class BetCalculationService {
  private readonly logger = new Logger(BetCalculationService.name);
  private readonly httpClient: AxiosInstance;
  private readonly username: string;
  private readonly password: string;
  private readonly baseUrl: string;
  private readonly callbackUrl: string;
  private userId: string | null = null;
  private phpSession: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly operationService: OperationService,
    private readonly eventGateway: EventGateway,
    private readonly languageService: LanguageService,
  ) {
    this.username = this.configService.get<string>('BETAPI_USERNAME');
    this.password = this.configService.get<string>('BETAPI_PASSWORD');
    this.baseUrl = this.configService.get<string>('BETAPI_BASE_URL') || 'https://admin.bsw.bet';
    this.callbackUrl = this.configService.get<string>('BETAPI_CALLBACK_URL') || 'https://imba.bet';

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Интерцептор для добавления PHPSESSID в каждый запрос
    this.httpClient.interceptors.request.use(async (config) => {
      await this.ensureAuthenticated();
      if (this.phpSession) config.headers.Cookie = this.phpSession;
      return config;
    });
  }

  private async authenticate(): Promise<void> {
    const response = await axios.post(`${this.baseUrl}/WebServices/BCService.asmx/LogIn/`, {
      login: this.username,
      password: this.password,
    });

    this.logger.log('BetAPI authentication response: ' + JSON.stringify(response.data));

    if (response.data?.d?.UserId) {
      this.userId = response.data.d.UserId;
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) this.phpSession = setCookieHeader.join('; ');
      this.logger.log('PHPSESSID: ' + this.phpSession);
    } else {
      throw new Error('BetAPI authentication failed');
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.userId || !this.phpSession) await this.authenticate();
  }

  // CreateBetDto удалён — принимаем с фронтенда произвольную структуру
  async createUserBet(userId: string, createBetDto: any): Promise<{ 
    betId: string; 
    status: string; 
    potentialPayout: number; 
    dbBetId?: number;
    coefficientChanged?: boolean;
    originalCoefficient?: number;
    actualCoefficient?: number;
  }> {
    await this.ensureAuthenticated();

    let operationId: number | null = null;

    // Проверяем, является ли это экспресс ставкой с массивом игр
    const { bets, betType, betVariant, stake, currency, accountType } = createBetDto ?? {};
    
    if (betVariant === 'EXPRESS' && Array.isArray(bets) && bets.length > 1) {
      return this.createExpressBet(userId, createBetDto);
    }

    // Нормализация и валидация входящих данных для обычной ставки
    const {
      eventId,
      marketId,
      outcomeId,
      odds,
      groupNumber,
      outcomeNumber,
      numericOutcome,
      isLive,      // если придёт с фронта — используем, иначе по умолчанию 'line'
      betInfo,     // не используется BetAPI в list_bets, но может быть в логах
      subGameId,   // ID под-игры для ставок на sub_games
      subGameName, // Название под-игры для отображения
    } = createBetDto ?? {};

    // Детальное логирование для отладки
    this.logger.debug(`[DEBUG] Bet data received: eventId=${eventId}, subGameId=${subGameId}, subGameName=${subGameName}, isLive=${isLive}, marketId=${marketId}, outcomeId=${outcomeId}, odds=${odds}`);

    const errors: Array<{ property: string; constraints: Record<string, string> }> = [];
    const addErr = (property: string, key: string, msg: string) => {
      errors.push({ property, constraints: { [key]: msg } });
    };

    if (!eventId || typeof eventId !== 'string') addErr('eventId', 'isNotEmpty', 'eventId is required and must be a string');

    const oddsNum = Number(odds);
    if (!Number.isFinite(oddsNum) || oddsNum <= 0) addErr('odds', 'isPositive', 'odds must be a positive number');

    const stakeNum = Number(stake);
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) addErr('stake', 'isPositive', 'stake must be a positive number');

    if (!currency || typeof currency !== 'string') addErr('currency', 'isNotEmpty', 'currency is required and must be a string');

    // PRE-VALIDATION: Check user balance before sending bet to BetAPI
    if (stakeNum > 0 && accountType !== 'bonus') {
      try {
        const userBalance = await this.prismaService.balance.findUnique({
          where: {
            userId_currencyCode: {
              userId: parseInt(userId),
              currencyCode: currency
            }
          }
        });

        if (!userBalance || userBalance.amount.lessThan(new Decimal(stakeNum))) {
          this.logger.warn(`Insufficient funds for user ${userId}: required ${stakeNum} ${currency}, available ${userBalance?.amount || 0}`);
          throw new HttpException({ 
            message: 'Insufficient funds',
            errorCode: 1,
            required: stakeNum,
            available: userBalance?.amount?.toString() || '0',
            currency: currency
          }, 400);
        }

        this.logger.debug(`Balance validation passed for user ${userId}: ${userBalance.amount} ${currency} >= ${stakeNum}`);
      } catch (error) {
        if (error instanceof HttpException) {
          throw error; // Re-throw our custom insufficient funds error
        }
        this.logger.error(`Error checking user balance for ${userId}:`, error);
        throw new HttpException({ message: 'Error validating user balance' }, 500);
      }
    }

    // Функция нормализации числовых кодов (принимает number либо numeric-like string)
    const normalizeInt = (val: unknown, name: string): number | null => {
      if (typeof val === 'number' && Number.isFinite(val) ) return Math.trunc(val);
      if (typeof val === 'string' && /^\d+$/.test(val)) return parseInt(val, 10);
      if (val == null) return null;
      addErr(name, 'isInt', `${name} must be a non-negative integer`);
      return null;
    };

    // Функция нормализации дробных чисел (принимает number либо numeric-like string)
    const normalizeFloat = (val: unknown, name: string): number | null => {
      if (typeof val === 'number' && Number.isFinite(val)) return val;
      if (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val)) return parseFloat(val);
      if (val == null) return null;
      addErr(name, 'isFloat', `${name} must be a valid number`);
      return null;
    };

    // Пытаемся получить числовые коды из приоритетных полей, иначе пробуем распарсить marketId/outcomeId, если те numeric-like
    let gn: number | null = normalizeInt(groupNumber, 'groupNumber');
    let on: number | null = normalizeInt(outcomeNumber, 'outcomeNumber');

    if (gn === null && (typeof marketId === 'string' || typeof marketId === 'number')) {
      const parsed = normalizeInt(marketId as any, 'groupNumber');
      if (parsed !== null) {
        gn = parsed;
        // Удаляем потенциальную ранее добавленную ошибку для groupNumber, если удалось распарсить
        const idx = errors.findIndex(e => e.property === 'groupNumber');
        if (idx >= 0) errors.splice(idx, 1);
      }
    }
    if (on === null && (typeof outcomeId === 'string' || typeof outcomeId === 'number')) {
      const parsed = normalizeInt(outcomeId as any, 'outcomeNumber');
      if (parsed !== null) {
        on = parsed;
        const idx = errors.findIndex(e => e.property === 'outcomeNumber');
        if (idx >= 0) errors.splice(idx, 1);
      }
    }

    // numericOutcome по умолчанию 0, если не пришёл
    let no: number | null = normalizeFloat(numericOutcome, 'numericOutcome');
    if (no === null) no = 0;

    // Если после всех попыток нет валидных числовых кодов — это ошибка
    if (gn === null) addErr('groupNumber', 'isNotEmpty', 'groupNumber is required (numeric). Provide it explicitly or pass numeric marketId');
    if (on === null) addErr('outcomeNumber', 'isNotEmpty', 'outcomeNumber is required (numeric). Provide it explicitly or pass numeric outcomeId');

    const normBetType: string = typeof betType === 'string' ? betType : 'SINGLE';
    const normBetVariant: string = typeof betVariant === 'string' ? betVariant : 'ORDINAR';

    if (errors.length) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    // Определяем префикс live/line для BetAPI
    this.logger.debug(`🔍 [isLive DEBUG] Received isLive: ${isLive} (type: ${typeof isLive})`);
    const prefix = typeof isLive === 'boolean' ? (isLive ? 'live' : 'line') : 'line';
    this.logger.debug(`🔍 [PREFIX DEBUG] Selected prefix: ${prefix}`);

    // Для подыгр используем subGameId, для обычных игр - eventId
    const gameIdForBetApi = subGameId ? String(subGameId) : eventId;

    // Логирование для отладки
    this.logger.debug(`[DEBUG] BetAPI string formation: prefix=${prefix}, gameIdForBetApi=${gameIdForBetApi} (subGameId=${subGameId}, eventId=${eventId}), gn=${gn}, on=${on}, no=${no}, oddsNum=${oddsNum}`);

    // Специальное логирование для тоталов
    const betInfoStr = typeof betInfo === 'string' ? betInfo : JSON.stringify(betInfo);
    if (betInfo && (betInfoStr.includes('тотал') || betInfoStr.includes('Тотал') || betInfoStr.includes('TOTAL') || betInfoStr.includes('Меньше') || betInfoStr.includes('Больше') || betType === 'TOTAL')) {
      this.logger.debug(`🎯 [TOTALS] Bet data: betInfo=${betInfoStr}, marketId="${marketId}", outcomeId="${outcomeId}", groupNumber=${groupNumber}, outcomeNumber=${outcomeNumber}, numericOutcome=${numericOutcome}`);
      this.logger.debug(`🎯 [TOTALS] Extracted: gn=${gn}, on=${on}, no=${no}`);
    }

    // ВАЖНО: В list_bets используем ТОЛЬКО числовые коды согласно документации
    const listBets = [
      `${prefix}#${gameIdForBetApi}|${gn}|${on}|${no}#${oddsNum}`
    ];

    const payload = {
      data: {
        list_bets: listBets,
        realAmount: stakeNum.toString(), // используем реальную сумму ставки
        currency: currency || 'KZT',
        lang: this.languageService.getDefaultLanguage(),
        remote_host: this.callbackUrl,
        rate_mode: 'accept',
      }
    };

    this.logger.log('Sending bet payload: ' + JSON.stringify({ ...payload, meta: { userId, betType: normBetType, betVariant: normBetVariant, betInfo } }));

    try {
      const response = await this.httpClient.post(`/bet/place/`, payload);
      this.logger.log('BetAPI response: ' + JSON.stringify(response.data));

      // Извлекаем данные из ответа BetAPI
      const betApiResponse: BetPlaceResponse = response.data;
      
      // КРИТИЧЕСКИ ВАЖНО: Проверяем errorCode перед списанием баланса
      const errorCode = betApiResponse?.errorCode || betApiResponse?.d?.BetHeadDetail?.ErrorCode;
      const fullErrorCode = betApiResponse?.fullErrorCode || betApiResponse?.d?.BetHeadDetail?.FullErrorCode;
      
      if (errorCode && errorCode !== 0) {
        this.logger.warn(`BetAPI rejected bet with errorCode: ${errorCode}, fullErrorCode: ${fullErrorCode}`);
        
        let errorMessage = 'Ставка была отклонена';
        
        // Обрабатываем errorCode = 1 с учетом fullErrorCode
        if (errorCode === 1) {
          const fullErrorCodeStr = String(fullErrorCode);
          this.logger.debug(`Processing errorCode=1 with fullErrorCode='${fullErrorCode}' (as string: '${fullErrorCodeStr}')`);
          
          if (fullErrorCodeStr === '0') {
            // Это не должно происходить, но на всякий случай
            errorMessage = 'Ставка принята';
          } else if (fullErrorCodeStr === '1') {
            errorMessage = 'Невозможно получить данные или данные повреждены. Попробуйте позже.';
          } else if (fullErrorCodeStr === '3') {
            errorMessage = 'Данный исход больше недоступен для ставок';
          } else if (fullErrorCodeStr === '99') {
            errorMessage = 'Произошла неизвестная ошибка. Обратитесь в поддержку.';
          } else {
            errorMessage = 'Недостаточно средств или превышен лимит ставки';
          }
          
          this.logger.debug(`Selected error message: '${errorMessage}'`);
        } else if (errorCode === 2) {
          errorMessage = 'Рынок закрыт или приостановлен';
        } else if (errorCode === 3) {
          errorMessage = 'Коэффициент изменился';
        } else if (errorCode === 4) {
          errorMessage = 'Событие не найдено или отменено';
        } else {
          errorMessage = `Ставка отклонена с кодом ошибки: ${errorCode}`;
        }
        
        throw new HttpException({ message: errorMessage }, 400);
      }

      const betCode = betApiResponse?.betCode || betApiResponse?.d?.BetHeadDetail?.BetCode;
      const betApiStatus = betApiResponse?.status || betApiResponse?.d?.BetHeadDetail?.Status || 1;
      const actualCoef = betApiResponse?.d?.BetHeadDetail?.Coef || oddsNum;
      const originalCoef = betApiResponse?.d?.BetHeadDetail?.CoefOrig;
      const isLiveBet = betApiResponse?.d?.BetHeadDetail?.IsLive || (prefix === 'live');

      // Проверяем изменение коэффициента
      let coefficientChanged = false;
      if (originalCoef && Math.abs(originalCoef - actualCoef) > 0.01) {
        this.logger.warn(`Coefficient changed for bet on ${eventId}: original=${originalCoef}, actual=${actualCoef}`);
        coefficientChanged = true;
      }

        // Только после успешной проверки errorCode списываем баланс (только для основного счёта)
      if (accountType !== 'bonus') {
        operationId = await this.prismaService.$transaction(async (prisma) => {
          const operation = await this.operationService.create(
            prisma,
            parseInt(userId),
            {
               type: 'OUTCOME',
               amount: new Decimal(stakeNum),
               currencyCode: currency,
               source: 'BET',
               status: 'SUCCESS',
               meta: {
                 description: `Ставка на ${eventId} - ${normBetType}`,
                 betType: normBetType,
                 betVariant: normBetVariant,
                 eventId: eventId,
                 betCode: betCode
               }
             }
          );
          return operation.id;
        });
      }

      // Проверяем существование SubGame если указан subGameId
      let validatedSubGameId: number | undefined = undefined;
      if (subGameId) {
        const subGameIdNum = parseInt(subGameId);
        const existingSubGame = await this.prismaService.subGame.findUnique({
          where: { id: subGameIdNum }
        });
        
        if (!existingSubGame) {
          this.logger.warn(`SubGame with ID ${subGameIdNum} not found. Creating bet without subGameId.`);
          // Можно либо создать SubGame автоматически, либо продолжить без него
          // Для безопасности продолжаем без subGameId
        } else {
          validatedSubGameId = subGameIdNum;
          this.logger.log(`SubGame with ID ${subGameIdNum} found: ${existingSubGame.gameName}`);
        }
      }

      // Сохраняем ставку в базу данных
      // Если ставка с бонусного счёта — обновляем бонусный баланс после успешного ответа BetAPI
      let isTokenBonus = false;
      if (accountType === 'bonus') {
        const bb = await this.prismaService.bonusBalance.findUnique({
          where: { userId_currencyCode: { userId: parseInt(userId), currencyCode: currency } }
        });
        if (!bb || !bb.isActive) {
          throw new HttpException({ message: 'Бонусный счёт не активен' }, 400);
        }
        // Проверка минимального коэффициента для бонусных ставок
        if (new Decimal(oddsNum).lessThan(bb.minOdds)) {
          throw new HttpException({ message: `Минимальный коэффициент для бонусных ставок: ${bb.minOdds}` }, 400);
        }
        if (bb.isTokenBased) {
          // Жетонная ставка
          if (bb.remainingTokens < bb.tokensPerBet) {
            throw new HttpException({ message: 'Недостаточно жетонов для ставки' }, 400);
          }
          if (stakeNum !== bb.tokensPerBet) {
            throw new HttpException({ message: `Нужно ставить ровно ${bb.tokensPerBet} жетон(ов)` }, 400);
          }
          await this.prismaService.bonusBalance.update({
            where: { userId_currencyCode: { userId: parseInt(userId), currencyCode: currency } },
            data: { remainingTokens: { decrement: bb.tokensPerBet } }
          });
          isTokenBonus = true;
        } else {
          // Денежный бонусный счёт
          if (bb.amount.lessThan(new Decimal(stakeNum))) {
            throw new HttpException({ message: 'Недостаточно средств на бонусном счёте' }, 400);
          }
          await this.prismaService.bonusBalance.update({
            where: { userId_currencyCode: { userId: parseInt(userId), currencyCode: currency } },
            data: {
              amount: { decrement: stakeNum },
              totalWagered: { increment: stakeNum }
            }
          });
        }
      }

      const savedBet = await this.saveBetToDatabase({
        userId: parseInt(userId),
        gameId: eventId,
        betType: normBetType,
        betVariant: normBetVariant,
        amount: stakeNum,
        cf: actualCoef,
        currencyCode: currency,
        betCode: betCode,
        betApiStatus: betApiStatus,
        betApiResponse: betApiResponse ? JSON.parse(JSON.stringify(betApiResponse)) : null,
        betInfo: (() => {
          const base = betInfo || `${prefix} bet on ${eventId}`;
          return isTokenBonus ? `${base} [TOKEN]` : base;
        })(),
        ocId: on,
        gameIdExternal: parseInt(eventId),
        subGameId: validatedSubGameId,
        subGameName: subGameName,
      });

      const potentialPayout = stakeNum * actualCoef;

      return { 
        betId: betCode || savedBet.id.toString(), 
        status: 'PENDING', 
        potentialPayout,
        dbBetId: savedBet.id,
        coefficientChanged,
        originalCoefficient: originalCoef,
        actualCoefficient: actualCoef
      };
    } catch (error: any) {
      let message = 'Failed to place bet';

      // Если произошла ошибка после списания баланса, нужно сделать rollback
      if (operationId) {
        try {
          await this.prismaService.$transaction(async (prisma) => {
            await this.operationService.updateStatus(prisma, operationId, OperationStatus.FAILED);
          });
          this.logger.warn(`Rollback operation ${operationId} due to bet placement error`);
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback operation ${operationId}:`, rollbackError);
          // Продолжаем выполнение, чтобы показать пользователю основную ошибку
        }
      }

      if (axios.isAxiosError(error)) {
        const raw = (error.response?.data as any) ?? {};
        const apiMsg = raw?.message || raw?.error || error.message;
        message = String(apiMsg || 'BetAPI request failed');

        // Нормализуем ключевые сообщения, которые ожидает фронтенд
        if (/exist_bet/i.test(message)) message = 'Данный исход больше недоступен для ставок';
        else if (/error_repeat_bet_data/i.test(message)) message = 'Нельзя делать ставки из одного матча на разные исходы в экспрессе';
        else if (/error_block_bet_data/i.test(message)) message = 'Ставка временно заблокирована для приема';
        else if (/insufficient/i.test(message)) message = 'Недостаточно средств';
        else if (/market.*closed/i.test(message)) message = 'Рынок закрыт';
        else if (/coeff(icient)?/i.test(message) && /chang(ed|e)/i.test(message)) message = 'Коэффициент изменился';
        else if (/game.*not.*found/i.test(message)) message = 'Игра не найдена';
        else if (/market.*not.*found/i.test(message)) message = 'Рынок не найден';
      } else if (error instanceof Error) {
        message = error.message;
      }

      // Возвращаем 400, чтобы фронт мог показать пользовательскую ошибку
      throw new HttpException({ message }, 400);
    }
  }

  async getUserBets(userId: string, status?: string) {
    try {
      const whereClause: any = {
        userId: parseInt(userId)
      };

      if (status) {
        whereClause.status = status;
      }

      const bets = await this.prismaService.bet.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          game: true
        }
      });

      // Загружаем активные бонусные балансы пользователя для расчёта прогресса жетонов
      const bonusBalances = await this.prismaService.bonusBalance.findMany({
        where: { userId: parseInt(userId), isActive: true },
      });
      const bonusByCurrency = new Map<string, typeof bonusBalances[number]>();
      for (const bb of bonusBalances) {
        bonusByCurrency.set(bb.currencyCode, bb);
      }

      // Получаем SubGame данные для ставок, которые имеют subGameId или subGameName
      const subGameIds = bets.filter(bet => bet.subGameId).map(bet => bet.subGameId);
      const gameIdsWithSubGameName = bets.filter(bet => bet.subGameName && !bet.subGameId).map(bet => bet.gameId);
      
      // Ищем SubGame по subGameId
      const subGamesByIds = subGameIds.length > 0 ? await this.prismaService.subGame.findMany({
        where: { id: { in: subGameIds } }
      }) : [];
      
      // Ищем SubGame по subEventId для ставок с subGameName, но без subGameId
      const subGamesByGameIds = gameIdsWithSubGameName.length > 0 ? await this.prismaService.subGame.findMany({
        where: { 
          subEventId: { in: gameIdsWithSubGameName }
        }
      }) : [];
      
      // Объединяем результаты
      const allSubGames = [...subGamesByIds, ...subGamesByGameIds];
      const subGameMap = new Map(allSubGames.map(sg => [sg.id, sg]));
      const subGameByGameIdMap = new Map(allSubGames.map(sg => [sg.gameId, sg]));
      const subGameBySubEventIdMap = new Map(allSubGames.map(sg => [sg.subEventId, sg]));
      
      // Получаем уникальные parentEventId для загрузки родительских игр
      const parentEventIds = [...new Set(allSubGames.map(sg => sg.parentEventId))];
      
      // Получаем данные родительских игр
      const parentGames = parentEventIds.length > 0 ? await this.prismaService.game.findMany({
        where: { eventId: { in: parentEventIds } }
      }) : [];
      
      // Создаем карту родительских игр
      const parentGameMap = new Map(parentGames.map(game => [game.eventId, game]));

      // Разделяем ставки на обычные и экспресс
      const ordinar = bets.filter(bet => bet.betVariant === 'ORDINAR').map(bet => {
        // Определяем, какие данные использовать - из SubGame или из основной Game
        let subGameData = null;
        if (bet.subGameId) {
          subGameData = subGameMap.get(bet.subGameId);
        } else if (bet.subGameName && !bet.subGameId) {
          // Ищем SubGame по subEventId, если есть subGameName, но нет subGameId
          subGameData = subGameBySubEventIdMap.get(bet.gameId);
        }
        const gameData = subGameData || bet.game;
        const isSubGame = !!subGameData;
        
        // Получаем данные для отображения
        let displayData = null;
        if (isSubGame && subGameData) {
          // Для SubGame получаем данные из родительской игры
          const parentGame = parentGameMap.get(subGameData.parentEventId);
          
          displayData = {
            eventId: subGameData.subEventId,
            eventName: parentGame?.eventName || subGameData.eventName || bet.subGameName || 'Событие',
            leagueName: parentGame?.leagueName || subGameData.leagueName || 'Unknown League',
            sport: parentGame?.sport || subGameData.sport || 'Unknown Sport',
            team1: parentGame?.team1 || subGameData.team1 || 'Team 1',
            team2: parentGame?.team2 || subGameData.team2 || 'Team 2',
            score: subGameData.score || parentGame?.score || 'Матч не начался',
            status: subGameData.status || parentGame?.status || 'PREMATCH',
            isSubGame: true,
            parentEventId: subGameData.parentEventId
          };
        } else if (gameData && 'eventName' in gameData) {
           // Для обычной игры используем данные из Game
           displayData = {
             eventId: bet.gameId,
             eventName: gameData.eventName || 'Событие',
             leagueName: gameData.leagueName || 'Unknown League',
             sport: gameData.sport || 'Unknown Sport',
             team1: gameData.team1 || 'Team 1',
             team2: gameData.team2 || 'Team 2',
             score: gameData.score || 'Матч не начался',
             status: gameData.status || 'PREMATCH',
             isSubGame: false
           };
         }

        const isToken = typeof bet.betInfo === 'string' && bet.betInfo.includes('[TOKEN]');
        const bb = bonusByCurrency.get(bet.currencyCode);
        const bonusProgress = isToken && bb && bb.isTokenBased ? {
          current: Math.max(0, (bb.totalTokens ?? 0) - (bb.remainingTokens ?? 0)),
          total: bb.totalTokens ?? 0,
        } : undefined;
        return {
          id: bet.id,
          userId: bet.userId,
          gameId: bet.gameId,
          betType: bet.betType,
          betVariant: bet.betVariant,
          amount: bet.amount,
          cf: bet.cf,
          currencyCode: isToken ? 'Token' : bet.currencyCode,
          status: this.getOutcomeType(bet.betApiStatus, bet.betApiExtStatus || 0),
          createdAt: bet.createdAt.toISOString(),
          updatedAt: bet.updatedAt.toISOString(),
          betInfo: bet.betInfo,
          subGameId: bet.subGameId,
          subGameName: bet.subGameName,
          parentEventId: subGameData?.parentEventId || (bet.subGameName ? bet.gameId : null), // Добавляем parentEventId для subGame
          game: displayData,
          bonusProgress,
          // Добавляем информацию из BetAPI ответа
          betCode: bet.betCode,
          betApiResponse: bet.betApiResponse
        };
      });

      // Получаем экспресс-ставки с их связанными ставками
      const expressBetIds = bets
        .filter(bet => bet.betVariant === 'EXPRESS')
        .map(bet => bet.expressBetId)
        .filter(id => id !== null);

      let express = [];
      if (expressBetIds.length > 0) {
        const expressBets = await this.prismaService.expressBet.findMany({
           where: {
             id: { in: expressBetIds }
           },
           include: {
             bets: {
               include: {
                 game: true
               }
             }
           }
         });

        express = expressBets.map(expressBet => ({
          id: expressBet.id,
          userId: expressBet.userId,
          amount: expressBet.amount,
          cf: expressBet.cf,
          currencyCode: (expressBet.bets || []).some(b => typeof b.betInfo === 'string' && b.betInfo.includes('[TOKEN]')) ? 'Token' : expressBet.currencyCode,
          status: this.getOutcomeType(expressBet.betApiStatus, 0),
          createdAt: expressBet.createdAt.toISOString(),
          updatedAt: expressBet.updatedAt.toISOString(),
          betCode: expressBet.betCode,
          betApiResponse: expressBet.betApiResponse,
          // Прикладываем прогресс для экспресса, если применимо (берём по валюте экспресса)
          bonusProgress: (() => {
            const bb = bonusByCurrency.get(expressBet.currencyCode);
            const hasToken = (expressBet.bets || []).some(b => typeof b.betInfo === 'string' && b.betInfo.includes('[TOKEN]'));
            return hasToken && bb && bb.isTokenBased ? {
              current: Math.max(0, (bb.totalTokens ?? 0) - (bb.remainingTokens ?? 0)),
              total: bb.totalTokens ?? 0,
            } : undefined;
          })(),
          bets: expressBet.bets.map(bet => {
             // Определяем, какие данные использовать - из SubGame или из основной Game
             let subGameData = null;
             if (bet.subGameId) {
               subGameData = subGameMap.get(bet.subGameId);
             } else if (bet.subGameName && !bet.subGameId) {
               // Ищем SubGame по subEventId, если есть subGameName, но нет subGameId
               subGameData = subGameBySubEventIdMap.get(bet.gameId);
             }
             const gameData = subGameData || bet.game;
             const isSubGame = !!subGameData;
             
             // Получаем данные для отображения
             let displayData = null;
             if (isSubGame && subGameData) {
               // Для SubGame получаем данные из meta поля
               const meta = subGameData.meta as any;
               const parentData = meta?.parentGame || {};
               
               displayData = {
                 eventId: subGameData.subEventId,
                 eventName: parentData.eventName || bet.subGameName || 'Событие',
                 leagueName: parentData.leagueName || 'Unknown League',
                 sport: parentData.sport || 'Unknown Sport',
                 team1: parentData.team1 || 'Team 1',
                 team2: parentData.team2 || 'Team 2',
                 score: subGameData.score || 'Матч не начался',
                 status: subGameData.status || 'PREMATCH',
                 isSubGame: true
               };
             } else if (gameData && 'eventName' in gameData) {
               // Для обычной игры используем данные из Game
               displayData = {
                 eventId: bet.gameId,
                 eventName: gameData.eventName || 'Событие',
                 leagueName: gameData.leagueName || 'Unknown League',
                 sport: gameData.sport || 'Unknown Sport',
                 team1: gameData.team1 || 'Team 1',
                 team2: gameData.team2 || 'Team 2',
                 score: gameData.score || 'Матч не начался',
                 status: gameData.status || 'PREMATCH',
                 isSubGame: false
               };
             }

             return {
               id: bet.id,
               gameId: bet.gameId,
               betType: bet.betType,
               amount: bet.amount,
               cf: bet.cf,
               status: this.getOutcomeType(bet.betApiStatus, bet.betApiExtStatus || 0),
               betInfo: bet.betInfo,
               game: displayData,
               subGameId: bet.subGameId,
               subGameName: bet.subGameName,
               parentEventId: subGameData?.parentEventId || null, // Добавляем parentEventId для subGame
               betCode: bet.betCode,
               betApiResponse: bet.betApiResponse
             };
           })
        }));
      }

      return {
        ordinar,
        express
      };
    } catch (error) {
      this.logger.error('Error fetching user bets:', error);
      throw new HttpException('Failed to fetch user bets', 500);
    }
  }

  async getBetStatus(betId: string): Promise<any> {
    try {
      const bet = await this.prismaService.bet.findFirst({
        where: {
          OR: [
            { betCode: betId },
            { id: parseInt(betId) }
          ]
        }
      });

      if (!bet) {
        throw new HttpException('Bet not found', 404);
      }

      return { 
        betId: bet.betCode || bet.id.toString(), 
        status: bet.status,
        amount: bet.amount,
        cf: bet.cf,
        betApiResponse: bet.betApiResponse
      };
    } catch (error) {
      this.logger.error('Error fetching bet status:', error);
      throw new HttpException('Failed to fetch bet status', 500);
    }
  }

  async processCallback(callbackData: any): Promise<void> {
    this.logger.debug('Processing callback data:', callbackData);
    
    try {
      // Проверяем, есть ли массив Heads или heads
      const heads = callbackData.Heads || callbackData.heads;
      if (heads && Array.isArray(heads)) {
        await this.processHeadsCallback(callbackData);
      } else {
        // Обрабатываем одиночный callback
        await this.processSingleCallback(callbackData);
      }
    } catch (error) {
      this.logger.error('Error processing callback:', error);
      throw error;
    }
  }

  private async processHeadsCallback(callbackData: any): Promise<void> {
    // Поддерживаем оба формата: Heads (старый) и heads (новый)
    const heads = callbackData.Heads || callbackData.heads;
    
    if (!heads || !Array.isArray(heads)) {
      this.logger.warn('Heads/heads array is missing or invalid in callback data:', callbackData);
      return;
    }
    
    this.logger.debug(`Processing ${heads.length} callbacks from heads array`);
    
    for (const head of heads) {
      try {
        await this.processSingleCallback(head);
      } catch (error) {
        this.logger.error(`Error processing head callback:`, error);
        // Продолжаем обработку остальных, не прерываем весь процесс
      }
    }
  }

  private async processSingleCallback(callbackData: any): Promise<void> {
    // Извлекаем betCode из разных возможных мест в структуре данных
    let betCode: string | undefined;
    
    // Новая структура: KeyHead.BarCode
    if (callbackData.KeyHead?.BarCode) {
      betCode = callbackData.KeyHead.BarCode;
    }
    // Старые форматы: BetCode или betCode
    else if (callbackData.BetCode || callbackData.betCode) {
      betCode = callbackData.BetCode || callbackData.betCode;
    }
    
    const status = callbackData.Status || callbackData.status;
    const extStatus = callbackData.ExtStatus || callbackData.extStatus || 0;
    const amountOut = callbackData.AmountOut || callbackData.amountOut || 0;
    
    if (!betCode) {
      this.logger.warn('BetCode is missing in callback data. Checked KeyHead.BarCode, BetCode, and betCode fields:', callbackData);
      return;
    }

    this.logger.debug(`Processing single callback for bet ${betCode}:`, {
      status,
      extStatus,
      amountOut,
      source: callbackData.KeyHead?.BarCode ? 'KeyHead.BarCode' : 'legacy format',
      originalData: callbackData
    });

    // Используем транзакцию для атомарности операций
    await this.prismaService.$transaction(async (prisma) => {
      await this.processBetStatusUpdate(prisma, betCode, status, extStatus, amountOut, callbackData);
    });
  }

  /**
   * Обрабатывает обновление статуса ставки с пересчетом баланса
   */
  private async processBetStatusUpdate(
    prisma: any,
    betCode: string,
    newStatus: number,
    newExtStatus: number,
    amountOut: number,
    callbackData: any
  ): Promise<void> {
    // Находим ставку в базе
    const bet = await prisma.bet.findFirst({
      where: { betCode },
      include: { user: true }
    });

    if (!bet) {
      this.logger.warn(`Bet with code ${betCode} not found`);
      return;
    }

    const prevStatus = bet.lastStatus ?? bet.betApiStatus;
    const prevExtStatus = bet.lastExtStatus ?? bet.betApiExtStatus ?? 0;
    const prevAmountOut = bet.amountOut ? Number(bet.amountOut) : 0;

    this.logger.debug(`Bet ${betCode} status comparison:`, {
      userId: bet.userId,
      prevStatus,
      prevExtStatus,
      prevAmountOut,
      newStatus,
      newExtStatus,
      amountOut: Number(amountOut)
    });

    // Генерируем хэш для текущего callback'а
    const callbackHash = this.generateCallbackHash(callbackData);
    
    // НОВАЯ ЛОГИКА: Проверяем обработку на уровне отдельных игр
    const processedGameHashes = this.extractProcessedGameHashes(callbackData, bet.processedCallbacks || []);
    
    // Если все игры в текущем callback уже были обработаны, пропускаем
    if (processedGameHashes.allGamesProcessed) {
      this.logger.warn(`Bet ${betCode} - all games in callback already processed, skipping update`, {
        processedGames: processedGameHashes.processedCount,
        totalGames: processedGameHashes.totalCount,
        newGames: processedGameHashes.newGameHashes,
        callbackHash
      });
      return;
    }
    
    // Проверяем, был ли этот точный callback уже обработан (fallback)
    if (bet.processedCallbacks && bet.processedCallbacks.includes(callbackHash)) {
      this.logger.warn(`Bet ${betCode} callback already processed (hash: ${callbackHash}), skipping update`, {
        callbackData,
        existingCallbacks: bet.processedCallbacks,
        currentHash: callbackHash
      });
      return;
    }

    // Дополнительное логирование для отладки
    this.logger.log(`Processing callback for bet ${betCode}:`, {
      userId: bet.userId,
      callbackHash,
      existingCallbacksCount: bet.processedCallbacks?.length || 0,
      isFirstCallback: !bet.processedCallbacks || bet.processedCallbacks.length === 0
    });

    // Определяем типы исходов для правильной обработки
    const prevOutcome = this.getOutcomeType(prevStatus, prevExtStatus);
    const newOutcome = this.getOutcomeType(newStatus, newExtStatus);

    // Проверяем, изменились ли статусы
    const statusChanged = prevStatus !== newStatus || prevExtStatus !== newExtStatus;
    const outcomeChanged = prevOutcome !== newOutcome;
    const amountChanged = prevAmountOut !== Number(amountOut);

    this.logger.log(`Bet ${betCode} outcome transition:`, {
      userId: bet.userId,
      outcomeChange: `${prevOutcome} → ${newOutcome}`,
      statusChange: `${prevStatus}(${prevExtStatus}) → ${newStatus}(${newExtStatus})`,
      amountChange: `${prevAmountOut} → ${amountOut}`,
      currencyCode: bet.currencyCode,
      statusChanged,
      outcomeChanged,
      amountChanged,
      shouldProcess: statusChanged || outcomeChanged || amountChanged
    });

    // Обрабатываем переходы между исходами
    await this.processOutcomeTransition(
      prisma,
      bet,
      betCode,
      prevOutcome,
      newOutcome,
      prevAmountOut,
      Number(amountOut)
    );

    // Определяем новое состояние жизненного цикла
    const newLifecycleState = this.determineLifecycleState(bet.lifecycleState, prevStatus, newStatus);

    // Обновляем ставку в базе
    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        lastStatus: prevStatus, // Сохраняем предыдущий статус
        lastExtStatus: prevExtStatus, // Сохраняем предыдущий ExtStatus
        betApiStatus: newStatus,
        betApiExtStatus: newExtStatus,
        amountOut: new Decimal(amountOut),
        lifecycleState: newLifecycleState,
        betApiResponse: callbackData,
        processedCallbacks: {
          push: callbackHash // Добавляем хэш обработанного callback'а
        },
        updatedAt: new Date()
      }
    });

    this.logger.log(`Bet ${betCode} updated successfully:`, {
      newLifecycleState
    });

    // Если это экспресс ставка, проверяем и обновляем статус ExpressBet
    if (bet.expressBetId) {
      await this.updateExpressBetStatus(prisma, bet.expressBetId, betCode);
    }
  }

  /**
   * Обновляет статус ExpressBet на основе статусов всех связанных ставок
   */
  private async updateExpressBetStatus(
    prisma: any,
    expressBetId: number,
    triggerBetCode: string
  ): Promise<void> {
    try {
      // Получаем ExpressBet с всеми связанными ставками
      const expressBet = await prisma.expressBet.findUnique({
        where: { id: expressBetId },
        include: {
          bets: true
        }
      });

      if (!expressBet) {
        this.logger.warn(`ExpressBet ${expressBetId} not found`);
        return;
      }

      // Получаем статусы всех ставок в экспрессе
      const betStatuses = expressBet.bets.map(bet => ({
        id: bet.id,
        betCode: bet.betCode,
        outcome: this.getOutcomeType(bet.betApiStatus, bet.betApiExtStatus || 0),
        status: bet.betApiStatus,
        extStatus: bet.betApiExtStatus || 0
      }));

      this.logger.log(`ExpressBet ${expressBetId} status check (triggered by ${triggerBetCode}):`, {
        totalBets: betStatuses.length,
        statuses: betStatuses.map(b => `${b.betCode}: ${b.outcome}`)
      });

      // Определяем итоговый статус экспресс ставки
      const { finalStatus, finalExtStatus, shouldCalculatePayout } = this.calculateExpressBetOutcome(betStatuses);
      const finalOutcome = this.getOutcomeType(finalStatus, finalExtStatus);

      // Проверяем, изменился ли статус
      const currentOutcome = this.getOutcomeType(expressBet.betApiStatus, 0);
      
      if (currentOutcome !== finalOutcome) {
        this.logger.log(`ExpressBet ${expressBetId} status change: ${currentOutcome} → ${finalOutcome}`);

        // Рассчитываем выплату для экспресс ставки
        let amountOut = 0;
        if (shouldCalculatePayout && finalOutcome === 'WIN') {
          // Для выигрышной экспресс ставки умножаем сумму на общий коэффициент
          amountOut = Number(expressBet.amount) * Number(expressBet.cf);
        } else if (finalOutcome === 'RETURN') {
          // Для возврата возвращаем исходную сумму
          amountOut = Number(expressBet.amount);
        }

        // Обрабатываем переход между исходами для экспресс ставки
        await this.processExpressBetOutcomeTransition(
          prisma,
          expressBet,
          currentOutcome,
          finalOutcome,
          amountOut
        );

        // Обновляем ExpressBet
        await prisma.expressBet.update({
          where: { id: expressBetId },
          data: {
            betApiStatus: finalStatus,
            status: finalOutcome as any,
            updatedAt: new Date()
          }
        });

        this.logger.log(`ExpressBet ${expressBetId} updated to ${finalOutcome}, payout: ${amountOut}`);
      } else {
        this.logger.debug(`ExpressBet ${expressBetId} status unchanged: ${currentOutcome}`);
      }
    } catch (error) {
      this.logger.error(`Error updating ExpressBet ${expressBetId} status:`, error);
    }
  }

  /**
   * Рассчитывает итоговый статус экспресс ставки на основе статусов всех игр
   */
  private calculateExpressBetOutcome(betStatuses: Array<{
    outcome: string;
    status: number;
    extStatus: number;
  }>): {
    finalStatus: number;
    finalExtStatus: number;
    shouldCalculatePayout: boolean;
  } {
    const outcomes = betStatuses.map(b => b.outcome);
    
    // Если есть хотя бы одна проигрышная ставка - весь экспресс проигрывает
    if (outcomes.includes('LOSE')) {
      return { finalStatus: 4, finalExtStatus: 0, shouldCalculatePayout: false };
    }
    
    // Если есть незавершенные ставки - экспресс еще в ожидании
    if (outcomes.includes('PENDING')) {
      return { finalStatus: 1, finalExtStatus: 0, shouldCalculatePayout: false };
    }
    
    // Если все ставки выиграли - экспресс выигрывает
    if (outcomes.every(outcome => outcome === 'WIN')) {
      return { finalStatus: 2, finalExtStatus: 0, shouldCalculatePayout: true };
    }
    
    // Если есть возвраты, но нет проигрышей и все остальные выиграли - возврат
    if (outcomes.includes('RETURN') && outcomes.every(outcome => ['WIN', 'RETURN'].includes(outcome))) {
      return { finalStatus: 3, finalExtStatus: 0, shouldCalculatePayout: false };
    }
    
    // По умолчанию - ожидание
    return { finalStatus: 1, finalExtStatus: 0, shouldCalculatePayout: false };
  }

  /**
   * Обрабатывает переход между исходами экспресс ставки
   */
  private async processExpressBetOutcomeTransition(
    prisma: any,
    expressBet: any,
    prevOutcome: string,
    newOutcome: string,
    amountOut: number
  ): Promise<void> {
    const betAmount = Number(expressBet.amount);

    // Определяем, содержит ли экспресс токен-ставки
    let expressHasTokenBets = false;
    try {
      const expressBetsChildren = await prisma.bet.findMany({ where: { expressBetId: expressBet.id } });
      expressHasTokenBets = (expressBetsChildren || []).some((b: any) => typeof b.betInfo === 'string' && b.betInfo.includes('[TOKEN]'));
    } catch {}

    // Если экспресс токенный — не начисляем деньги на основной счёт
    if (expressHasTokenBets) {
      // При первом определенном проигрыше по экспрессу деактивируем токенный бонус
      if (newOutcome === 'LOSE' && prevOutcome !== 'LOSE') {
        try {
          await prisma.bonusBalance.updateMany({
            where: {
              userId: expressBet.userId,
              currencyCode: expressBet.currencyCode,
              isActive: true,
              isTokenBased: true
            },
            data: {
              isActive: false,
              remainingTokens: 0,
              updatedAt: new Date()
            }
          });
          // Обновляем историю бонусов: помечаем как проигранный и закрытый
          await prisma.bonusHistory.updateMany({
            where: {
              userId: expressBet.userId,
              currencyCode: expressBet.currencyCode,
              isTokenBased: true,
              status: 'PENDING'
            },
            data: {
              status: 'LOSE',
              remainingTokens: 0,
              completedAt: new Date(),
              notes: 'Бонус завершен из-за проигрыша экспресс-ставки'
            }
          });
          this.logger.log(`ExpressBet ${expressBet.id}: token bonus deactivated on LOSE, tokens set to 0`);
        } catch (e) {
          this.logger.error(`Failed to deactivate token bonus on express LOSE for user ${expressBet.userId}`, e);
        }
      }
      this.logger.log(`ExpressBet ${expressBet.id}: token-based — skipping main balance payouts/refunds for ${prevOutcome} → ${newOutcome}`);
      return;
    }

    // Логика аналогична обычным ставкам, но для экспресс ставки
    if (prevOutcome === 'PENDING' && newOutcome === 'WIN') {
      await this.operationService.create(prisma, expressBet.userId, {
        amount: new Decimal(amountOut),
        currencyCode: expressBet.currencyCode,
        meta: {
          title: 'Выигрыш по экспресс ставке',
          betCode: expressBet.betCode,
          expressBetId: expressBet.id,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          winAmount: amountOut,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });
      this.logger.log(`ExpressBet ${expressBet.id}: WIN payout +${amountOut} ${expressBet.currencyCode}`);
    } else if (prevOutcome === 'PENDING' && newOutcome === 'RETURN') {
      await this.operationService.create(prisma, expressBet.userId, {
        amount: new Decimal(betAmount),
        currencyCode: expressBet.currencyCode,
        meta: {
          title: 'Возврат экспресс ставки',
          betCode: expressBet.betCode,
          expressBetId: expressBet.id,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          returnAmount: betAmount,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });
      this.logger.log(`ExpressBet ${expressBet.id}: RETURN refund +${betAmount} ${expressBet.currencyCode}`);
    }
    // Добавить другие переходы по необходимости
  }

  /**
   * Обрабатывает переход между исходами ставки с правильной логикой начислений
   */
  private async processOutcomeTransition(
    prisma: any,
    bet: any,
    betCode: string,
    prevOutcome: string,
    newOutcome: string,
    prevAmountOut: number,
    newAmountOut: number
  ): Promise<void> {
    const betAmount = Number(bet.amount);
    const isTokenBet = typeof bet.betInfo === 'string' && bet.betInfo.includes('[TOKEN]');

    // Проверяем, есть ли активный бонусный баланс для этого пользователя и валюты
    const activeBonusBalance = await prisma.bonusBalance.findFirst({
      where: {
        userId: bet.userId,
        currencyCode: bet.currencyCode,
        isActive: true
      }
    });

    // Обрабатываем проигрыш бонусных ставок (как токенных, так и денежных)
    if (newOutcome === 'LOSE' && prevOutcome !== 'LOSE' && activeBonusBalance) {
      try {
        if (activeBonusBalance.isTokenBased) {
          // Для токенных бонусов обнуляем токены
          await prisma.bonusBalance.updateMany({
            where: {
              userId: bet.userId,
              currencyCode: bet.currencyCode,
              isActive: true,
              isTokenBased: true
            },
            data: {
              isActive: false,
              remainingTokens: 0,
              updatedAt: new Date()
            }
          });
          // Обновляем историю бонусов: помечаем как проигранный и закрытый
          await prisma.bonusHistory.updateMany({
            where: {
              userId: bet.userId,
              currencyCode: bet.currencyCode,
              isTokenBased: true,
              status: 'PENDING'
            },
            data: {
              status: 'LOSE',
              remainingTokens: 0,
              completedAt: new Date(),
              notes: 'Бонус завершен из-за проигрыша ставки'
            }
          });
          this.logger.log(`Bet ${betCode}: token bonus deactivated on LOSE, tokens set to 0`);
        } else {
          // Для денежных бонусов обнуляем amount
          await prisma.bonusBalance.updateMany({
            where: {
              userId: bet.userId,
              currencyCode: bet.currencyCode,
              isActive: true,
              isTokenBased: false
            },
            data: {
              isActive: false,
              amount: 0,
              updatedAt: new Date()
            }
          });
          // Обновляем историю бонусов: помечаем как проигранный и закрытый
          await prisma.bonusHistory.updateMany({
            where: {
              userId: bet.userId,
              currencyCode: bet.currencyCode,
              isTokenBased: false,
              status: 'PENDING'
            },
            data: {
              status: 'LOSE',
              amount: 0,
              completedAt: new Date(),
              notes: 'Бонус завершен из-за проигрыша ставки'
            }
          });
          this.logger.log(`Bet ${betCode}: money bonus deactivated on LOSE, amount set to 0`);
        }
      } catch (e) {
        this.logger.error(`Failed to deactivate bonus on LOSE for user ${bet.userId}`, e);
      }
    }

    // Для токен-ставок и денежных бонусных ставок не зачисляем и не списываем деньги на основной счёт
    if (isTokenBet || activeBonusBalance) {
      this.logger.log(`Bet ${betCode}: bonus-based — skipping main balance payouts/refunds for ${prevOutcome} → ${newOutcome}`);
      return;
    }

    // CASE 1: PENDING -> WIN (первый выигрыш)
    if (prevOutcome === 'PENDING' && newOutcome === 'WIN') {
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(newAmountOut),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Выигрыш по ставке',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          winAmount: newAmountOut,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });
      this.logger.log(`Bet ${betCode}: WIN payout +${newAmountOut} ${bet.currencyCode}`);
    }

    // CASE 2: PENDING -> RETURN (первый возврат)
    else if (prevOutcome === 'PENDING' && newOutcome === 'RETURN') {
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(betAmount),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Возврат ставки',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          returnAmount: betAmount,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });
      this.logger.log(`Bet ${betCode}: RETURN refund +${betAmount} ${bet.currencyCode}`);
    }

    // CASE 3: WIN -> LOSE (отмена выигрыша)
    else if (prevOutcome === 'WIN' && newOutcome === 'LOSE') {
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(prevAmountOut),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Отмена выигрыша',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          cancelledWin: prevAmountOut,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'OUTCOME'
      });
      this.logger.log(`Bet ${betCode}: WIN cancelled -${prevAmountOut} ${bet.currencyCode}`);
    }

    // CASE 4: WIN -> RETURN (отмена выигрыша + возврат ставки)
    else if (prevOutcome === 'WIN' && newOutcome === 'RETURN') {
      // Отменяем выигрыш
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(prevAmountOut),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Отмена выигрыша',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome} (step 1)`,
          cancelledWin: prevAmountOut,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'OUTCOME'
      });
      
      // Возвращаем ставку
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(betAmount),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Возврат ставки',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome} (step 2)`,
          returnAmount: betAmount,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });
      this.logger.log(`Bet ${betCode}: WIN→RETURN -${prevAmountOut} +${betAmount} ${bet.currencyCode}`);
    }

    // CASE 5: LOSE -> WIN (начисление выигрыша)
    else if (prevOutcome === 'LOSE' && newOutcome === 'WIN') {
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(newAmountOut),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Выигрыш по ставке',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          winAmount: newAmountOut,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });
      this.logger.log(`Bet ${betCode}: LOSE→WIN +${newAmountOut} ${bet.currencyCode}`);
    }

    // CASE 6: LOSE -> RETURN (возврат ставки)
    else if (prevOutcome === 'LOSE' && newOutcome === 'RETURN') {
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(betAmount),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Возврат ставки',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          returnAmount: betAmount,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });
      this.logger.log(`Bet ${betCode}: LOSE→RETURN +${betAmount} ${bet.currencyCode}`);
    }

    // CASE 7: RETURN -> WIN (отмена возврата + выигрыш)
    else if (prevOutcome === 'RETURN' && newOutcome === 'WIN') {
      // Отменяем возврат
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(betAmount),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Отмена возврата',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome} (step 1)`,
          cancelledReturn: betAmount,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'OUTCOME'
      });
      
      // Начисляем выигрыш
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(newAmountOut),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Выигрыш по ставке',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome} (step 2)`,
          winAmount: newAmountOut,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });
      this.logger.log(`Bet ${betCode}: RETURN→WIN -${betAmount} +${newAmountOut} ${bet.currencyCode}`);
    }

    // CASE 8: RETURN -> LOSE (отмена возврата)
    else if (prevOutcome === 'RETURN' && newOutcome === 'LOSE') {
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(betAmount),
        currencyCode: bet.currencyCode,
        meta: {
          title: 'Отмена возврата',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          cancelledReturn: betAmount,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'OUTCOME'
      });
      this.logger.log(`Bet ${betCode}: RETURN→LOSE -${betAmount} ${bet.currencyCode}`);
    }

    // CASE 9: WIN -> WIN (изменение суммы выплаты)
    else if (prevOutcome === 'WIN' && newOutcome === 'WIN' && prevAmountOut !== newAmountOut) {
      const difference = newAmountOut - prevAmountOut;
      await this.operationService.create(prisma, bet.userId, {
        amount: new Decimal(Math.abs(difference)),
        currencyCode: bet.currencyCode,
        meta: {
          title: difference > 0 ? 'Доначисление выигрыша' : 'Корректировка выигрыша',
          betCode,
          outcomeTransition: `${prevOutcome} → ${newOutcome}`,
          amountAdjustment: difference,
          prevAmount: prevAmountOut,
          newAmount: newAmountOut,
          betAmount
        },
        source: 'BET',
        status: 'SUCCESS',
        type: difference > 0 ? 'INCOME' : 'OUTCOME'
      });
      this.logger.log(`Bet ${betCode}: WIN adjustment ${difference > 0 ? '+' : ''}${difference} ${bet.currencyCode}`);
    }

    // Остальные случаи (PENDING->LOSE, одинаковые статусы) - без операций
    else {
      this.logger.log(`Bet ${betCode}: No balance operations for ${prevOutcome} → ${newOutcome}`);
    }

    // Отправляем уведомление пользователю о изменении статуса ставки
    await this.sendBetStatusNotification(bet.userId, betCode, newOutcome, newAmountOut, bet.amount, bet.currencyCode);
  }

  /**
   * Отправляет уведомление пользователю об изменении статуса ставки
   */
  private async sendBetStatusNotification(
    userId: number,
    betCode: string,
    status: string,
    amountOut: number,
    betAmount: number,
    currencyCode: string
  ): Promise<void> {
    try {
      // Отправляем уведомление только для финальных статусов
      if (!['WIN', 'LOSE', 'RETURN'].includes(status)) {
        return;
      }

      const notification = {
        eventId: `user_${userId}`,
        type: 'bet_status_changed',
        payload: {
          betCode,
          status,
          amount: status === 'WIN' ? amountOut : (status === 'RETURN' ? betAmount : 0),
          betAmount,
          currencyCode,
          timestamp: new Date().toISOString()
        }
      };

      // Используем новый метод для отправки уведомлений пользователю
      const sent = this.eventGateway.sendUserNotification(userId.toString(), notification as any);
      
      if (sent) {
        this.logger.log(`Bet notification sent to user ${userId}: ${betCode} → ${status}`);
      } else {
        this.logger.warn(`No active connections found for user ${userId} to send bet notification`);
      }
    } catch (error) {
      this.logger.error(`Failed to send bet notification: ${error.message}`, {
        userId,
        betCode,
        status,
        error
      });
    }
  }

  /**
   * Определяет тип исхода по статусу и ExtStatus
   */
  private getOutcomeType(status: number, extStatus: number): 'PENDING' | 'WIN' | 'LOSE' | 'RETURN' {
    if (status === 1) return 'PENDING';
    if (status === 2 && extStatus === 0) return 'WIN';
    if (status === 2 && extStatus === 1) return 'RETURN';
    if (status === 3) return 'RETURN';
    if (status === 4 && extStatus === 1) return 'RETURN';
    if (status === 4) return 'LOSE';
    
    this.logger.warn(`Unknown status combination: ${status}(${extStatus})`);
    return 'PENDING';
  }

  /**
   * Определяет новое состояние жизненного цикла купона
   */
  private determineLifecycleState(currentState: BetStatus, prevStatus: number, newStatus: number): BetStatus {
    const currentStateStr = currentState as string;
    
    // Если это первый расчет (переход из PENDING)
    if (currentState === BetStatus.PENDING && prevStatus === 1 && newStatus !== 1) {
      return 'CALCULATED' as BetStatus;
    }
    
    // Если это пересчет (статус уже был рассчитан ранее)
    if (currentStateStr === 'CALCULATED' && prevStatus !== 1 && newStatus !== 1) {
      return 'RECALCULATED' as BetStatus;
    }
    
    // Если уже был пересчет
    if (currentStateStr === 'RECALCULATED') {
      return 'RECALCULATED' as BetStatus;
    }
    
    return currentState;
  }


  async checkApiHealth(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      return true;
    } catch {
      return false;
    }
  }

  private async saveBetToDatabase(betData: {
    userId: number;
    gameId: string;
    betType: string;
    betVariant: string;
    amount: number;
    cf: number;
    currencyCode: string;
    betCode?: string;
    betApiStatus: number;
    betApiResponse: any;
    betInfo?: string;
    ocId?: number;
    gameIdExternal?: number;
    subGameId?: number;
    subGameName?: string;
  }) {
    try {
      // Если это экспресс ставка, создаем ExpressBet и связанную с ней Bet
      if (betData.betVariant === 'EXPRESS') {
        return await this.prismaService.$transaction(async (prisma) => {
          // Создаем запись ExpressBet
          const expressBet = await prisma.expressBet.create({
            data: {
              userId: betData.userId,
              amount: betData.amount,
              cf: betData.cf,
              currencyCode: betData.currencyCode,
              betCode: betData.betCode,
              betApiStatus: betData.betApiStatus,
              betApiResponse: betData.betApiResponse,
              status: BetStatus.PENDING
            }
          });

          this.logger.log(`ExpressBet created with ID: ${expressBet.id}`);

          // Создаем связанную запись Bet
          const bet = await prisma.bet.create({
            data: {
              userId: betData.userId,
              gameId: betData.gameId,
              betType: betData.betType,
              betVariant: betData.betVariant as any,
              amount: betData.amount,
              cf: betData.cf,
              currencyCode: betData.currencyCode,
              betCode: betData.betCode,
              betApiStatus: betData.betApiStatus,
              betApiResponse: betData.betApiResponse,
              betInfo: betData.betInfo,
              ocId: betData.ocId,
              gameIdExternal: betData.gameIdExternal,
              subGameId: betData.subGameId,
              subGameName: betData.subGameName,
              status: BetStatus.PENDING,
              lifecycleState: BetStatus.PENDING,
              expressBetId: expressBet.id // Связываем с ExpressBet
            },
          });

          this.logger.log(`Express Bet saved to database with ID: ${bet.id}, linked to ExpressBet: ${expressBet.id}`);
          return bet;
        });
      }

      // Для обычных ставок создаем только Bet
      const bet = await this.prismaService.bet.create({
        data: {
          userId: betData.userId,
          gameId: betData.gameId,
          betType: betData.betType,
          betVariant: betData.betVariant as any, // Assuming BetVariants enum exists
          amount: betData.amount,
          cf: betData.cf,
          currencyCode: betData.currencyCode,
          betCode: betData.betCode,
          betApiStatus: betData.betApiStatus,
          betApiResponse: betData.betApiResponse,
          betInfo: betData.betInfo,
          ocId: betData.ocId,
          gameIdExternal: betData.gameIdExternal,
          subGameId: betData.subGameId,
          subGameName: betData.subGameName,
          status: BetStatus.PENDING,
          lifecycleState: BetStatus.PENDING
        },
      });

      this.logger.log(`Bet saved to database with ID: ${bet.id}`);
      return bet;
    } catch (error) {
      this.logger.error(`Failed to save bet to database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Создает уникальный хэш для callback'а на основе ключевых полей
   * Исключает изменяющиеся поля как DateRecive и counter_repeat
   * ИСПРАВЛЕНИЕ: Генерирует хэши для отдельных игр, чтобы избежать дублирования начислений
   */
  private generateCallbackHash(callbackData: any): string {
    const betCode = callbackData.KeyHead?.BarCode || callbackData.BetCode || callbackData.betCode;
    const status = callbackData.Status || callbackData.status;
    const extStatus = callbackData.ExtStatus || callbackData.extStatus || 0;
    const amountOut = callbackData.AmountOut || callbackData.amountOut || 0;

    // НОВАЯ ЛОГИКА: Создаем хэши для отдельных игр в массиве Bets
    const gameHashes: string[] = [];
    
    if (callbackData.Bets && Array.isArray(callbackData.Bets)) {
      for (const bet of callbackData.Bets) {
        // Создаем хэш для каждой отдельной игры
        const gameKeyFields = {
          betCode,
          gameId: bet.gameId || bet.GameId,
          subGameId: bet.subGameId || bet.SubGameId,
          status: bet.status || bet.Status,
          extStatus: bet.extStatus || bet.ExtStatus || 0,
          outcome: bet.outcome || bet.Outcome,
          // Включаем только поля, специфичные для данной игры
        };
        
        const gameStableJson = JSON.stringify(gameKeyFields, Object.keys(gameKeyFields).sort());
        const gameHash = crypto.createHash('sha256').update(gameStableJson).digest('hex');
        gameHashes.push(gameHash);
      }
    }

    // Если есть отдельные игры, используем их хэши
    if (gameHashes.length > 0) {
      // Сортируем хэши для стабильности
      gameHashes.sort();
      const combinedGameHashes = gameHashes.join('|');
      
      // Создаем итоговый хэш на основе хэшей отдельных игр
      const finalKeyFields = {
        betCode,
        status,
        extStatus,
        amountOut,
        gameHashes: combinedGameHashes
      };
      
      const stableJson = JSON.stringify(finalKeyFields, Object.keys(finalKeyFields).sort());
      const hash = crypto.createHash('sha256').update(stableJson).digest('hex');
      
      this.logger.debug(`Generated game-level callback hash for bet ${betCode}:`, {
        gamesCount: gameHashes.length,
        gameHashes: gameHashes.map(h => h.substring(0, 8) + '...'),
        finalHash: hash.substring(0, 16) + '...'
      });
      
      return hash;
    }

    // Fallback: если нет массива Bets, используем старую логику
    const keyFields = {
      betCode,
      status,
      extStatus,
      amountOut,
      scores: callbackData.Scores,
    };

    const stableJson = JSON.stringify(keyFields, Object.keys(keyFields).sort());
    const hash = crypto.createHash('sha256').update(stableJson).digest('hex');
    
    this.logger.debug(`Generated fallback callback hash for bet ${betCode}:`, {
      keyFields,
      hash: hash.substring(0, 16) + '...'
    });
    
    return hash;
  }

  /**
   * Извлекает информацию о том, какие игры уже были обработаны
   * Возвращает информацию о новых и уже обработанных играх
   */
  private extractProcessedGameHashes(callbackData: any, processedCallbacks: string[]): {
    allGamesProcessed: boolean;
    processedCount: number;
    totalCount: number;
    newGameHashes: string[];
  } {
    const betCode = callbackData.KeyHead?.BarCode || callbackData.BetCode || callbackData.betCode;
    const newGameHashes: string[] = [];
    let processedCount = 0;

    // Если нет массива Bets, считаем что это не мульти-игровая ставка
    if (!callbackData.Bets || !Array.isArray(callbackData.Bets)) {
      return {
        allGamesProcessed: false,
        processedCount: 0,
        totalCount: 0,
        newGameHashes: []
      };
    }

    // Создаем хэши для каждой игры в текущем callback
    for (const bet of callbackData.Bets) {
      const gameKeyFields = {
        betCode,
        gameId: bet.gameId || bet.GameId,
        subGameId: bet.subGameId || bet.SubGameId,
        status: bet.status || bet.Status,
        extStatus: bet.extStatus || bet.ExtStatus || 0,
        outcome: bet.outcome || bet.Outcome,
      };
      
      const gameStableJson = JSON.stringify(gameKeyFields, Object.keys(gameKeyFields).sort());
      const gameHash = crypto.createHash('sha256').update(gameStableJson).digest('hex');
      
      // Проверяем, был ли этот хэш игры уже обработан
      const isGameProcessed = processedCallbacks.some(callback => callback.includes(gameHash));
      
      if (isGameProcessed) {
        processedCount++;
      } else {
        newGameHashes.push(gameHash);
      }
    }

    const totalCount = callbackData.Bets.length;
    const allGamesProcessed = processedCount === totalCount && totalCount > 0;

    this.logger.debug(`Game processing analysis for bet ${betCode}:`, {
      totalGames: totalCount,
      processedGames: processedCount,
      newGames: newGameHashes.length,
      allProcessed: allGamesProcessed
    });

    return {
      allGamesProcessed,
      processedCount,
      totalCount,
      newGameHashes
    };
  }

  private async createExpressBet(userId: string, createBetDto: any): Promise<{ 
    betId: string; 
    status: string; 
    potentialPayout: number; 
    dbBetId?: number;
    coefficientChanged?: boolean;
    originalCoefficient?: number;
    actualCoefficient?: number;
  }> {
    const { bets, stake, currency, betType, betVariant } = createBetDto;
    
    let operationId: number | null = null;
    const errors: Array<{ property: string; constraints: Record<string, string> }> = [];
    const addErr = (property: string, key: string, msg: string) => {
      errors.push({ property, constraints: { [key]: msg } });
    };

    // Валидация общих параметров
    const stakeNum = Number(stake);
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) addErr('stake', 'isPositive', 'stake must be a positive number');
    if (!currency || typeof currency !== 'string') addErr('currency', 'isNotEmpty', 'currency is required and must be a string');
    if (!Array.isArray(bets) || bets.length < 2) addErr('bets', 'minLength', 'Express bet must have at least 2 games');

    // PRE-VALIDATION: Check user balance before sending express bet to BetAPI
    if (stakeNum > 0) {
      try {
        const userBalance = await this.prismaService.balance.findUnique({
          where: {
            userId_currencyCode: {
              userId: parseInt(userId),
              currencyCode: currency
            }
          }
        });

        if (!userBalance || userBalance.amount.lessThan(new Decimal(stakeNum))) {
          this.logger.warn(`Insufficient funds for express bet user ${userId}: required ${stakeNum} ${currency}, available ${userBalance?.amount || 0}`);
          throw new HttpException({ 
            message: 'Insufficient funds for express bet',
            errorCode: 1,
            required: stakeNum,
            available: userBalance?.amount?.toString() || '0',
            currency: currency
          }, 400);
        }

        this.logger.debug(`Express bet balance validation passed for user ${userId}: ${userBalance.amount} ${currency} >= ${stakeNum}`);
      } catch (error) {
        if (error instanceof HttpException) {
          throw error; // Re-throw our custom insufficient funds error
        }
        this.logger.error(`Error checking user balance for express bet ${userId}:`, error);
        throw new HttpException({ message: 'Error validating user balance for express bet' }, 500);
      }
    }

    // VALIDATION: Check for bets from different sub-games of the same match
    try {
      // Собираем все subGameId из ставок
      const subGameIds = bets
        .map(bet => bet.subGameId)
        .filter(id => id !== undefined && id !== null);

      if (subGameIds.length > 0) {
        // Получаем данные о подыграх
        const subGames = await this.prismaService.subGame.findMany({
          where: {
            subEventId: { in: subGameIds }
          },
          select: {
            subEventId: true,
            parentEventId: true,
            gameName: true
          }
        });

        // Создаем карту subGameId -> parentEventId
        const subGameToParentMap = new Map(
          subGames.map(sg => [sg.subEventId, sg.parentEventId])
        );

        // Группируем ставки по parentEventId
        const parentEventGroups = new Map<string, string[]>();
        
        for (const bet of bets) {
          if (bet.subGameId && subGameToParentMap.has(bet.subGameId)) {
            const parentEventId = subGameToParentMap.get(bet.subGameId);
            if (!parentEventGroups.has(parentEventId)) {
              parentEventGroups.set(parentEventId, []);
            }
            parentEventGroups.get(parentEventId).push(bet.subGameId);
          }
        }

        // Проверяем, есть ли группы с более чем одной ставкой
        for (const [parentEventId, subGameIds] of parentEventGroups) {
          if (subGameIds.length > 1) {
            this.logger.warn(`Express bet rejected: multiple bets from same match ${parentEventId}: ${subGameIds.join(', ')}`);
            throw new HttpException({ 
              message: 'Нельзя создать экспресс-ставку из разных событий одного матча',
              errorCode: 'error_repeat_bet_data',
              details: {
                parentEventId,
                subGameIds,
                message: 'Ставки из одного матча на разные события не могут быть объединены в экспресс'
              }
            }, 400);
          }
        }

        this.logger.debug(`Express bet validation passed: no duplicate parent events found`);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // Re-throw our custom validation error
      }
      this.logger.error(`Error validating express bet for same match restriction ${userId}:`, error);
      throw new HttpException({ message: 'Error validating express bet restrictions' }, 500);
    }

    // Валидация каждой игры в экспресс ставке
    const listBets: string[] = [];
    let totalOdds = 1;

    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];
      const prefix = `bets[${i}]`;

      if (!bet.eventId || typeof bet.eventId !== 'string') {
        addErr(`${prefix}.eventId`, 'isNotEmpty', 'eventId is required and must be a string');
        continue;
      }

      const oddsNum = Number(bet.odds);
      if (!Number.isFinite(oddsNum) || oddsNum <= 0) {
        addErr(`${prefix}.odds`, 'isPositive', 'odds must be a positive number');
        continue;
      }

      // Нормализация числовых кодов
      const normalizeInt = (val: unknown, name: string): number | null => {
        if (typeof val === 'number' && Number.isFinite(val) && val >= 0) return Math.trunc(val);
        if (typeof val === 'string' && /^\d+$/.test(val)) return parseInt(val, 10);
        if (val == null) return null;
        addErr(`${prefix}.${name}`, 'isInt', `${name} must be a non-negative integer`);
        return null;
      };

      // Нормализация дробных чисел
      const normalizeFloat = (val: unknown, name: string): number | null => {
        if (typeof val === 'number' && Number.isFinite(val)) return val;
        if (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val)) return parseFloat(val);
        if (val == null) return null;
        addErr(`${prefix}.${name}`, 'isFloat', `${name} must be a valid number`);
        return null;
      };

      let gn: number | null = normalizeInt(bet.groupNumber, 'groupNumber');
      let on: number | null = normalizeInt(bet.outcomeNumber, 'outcomeNumber');

      // Fallback к marketId/outcomeId если числовые коды не указаны
      if (gn === null && (typeof bet.marketId === 'string' || typeof bet.marketId === 'number')) {
        const parsed = normalizeInt(bet.marketId as any, 'groupNumber');
        if (parsed !== null) gn = parsed;
      }
      if (on === null && (typeof bet.outcomeId === 'string' || typeof bet.outcomeId === 'number')) {
        const parsed = normalizeInt(bet.outcomeId as any, 'outcomeNumber');
        if (parsed !== null) on = parsed;
      }

      let no: number | null = normalizeFloat(bet.numericOutcome, 'numericOutcome');
      if (no === null) no = 0;

      if (gn === null) {
        addErr(`${prefix}.groupNumber`, 'isNotEmpty', 'groupNumber is required (numeric). Provide it explicitly or pass numeric marketId');
        continue;
      }
      if (on === null) {
        addErr(`${prefix}.outcomeNumber`, 'isNotEmpty', 'outcomeNumber is required (numeric). Provide it explicitly or pass numeric outcomeId');
        continue;
      }

      // Определяем префикс live/line для BetAPI
      const prefix_type = typeof bet.isLive === 'boolean' ? (bet.isLive ? 'live' : 'line') : 'line';
      
      // Для подыгр используем subGameId, для обычных игр - eventId
      const gameIdForBetApi = bet.subGameId ? String(bet.subGameId) : bet.eventId;
      
      // Добавляем в список ставок для BetAPI
      listBets.push(`${prefix_type}#${gameIdForBetApi}|${gn}|${on}|${no}#${oddsNum}`);
      totalOdds *= oddsNum;
    }

    if (errors.length) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    const payload = {
      data: {
        list_bets: listBets,
        realAmount: stakeNum.toString(),
        currency: currency || 'USD',
        lang: this.languageService.getDefaultLanguage(),
        remote_host: this.callbackUrl,
        rate_mode: 'accept',
      }
    };

    this.logger.log('Sending EXPRESS bet payload: ' + JSON.stringify({ ...payload, meta: { userId, betType, betVariant, betsCount: bets.length } }));

    try {
      const response = await this.httpClient.post(`/bet/place/`, payload);
      this.logger.log('BetAPI EXPRESS response: ' + JSON.stringify(response.data));

      const betApiResponse: BetPlaceResponse = response.data;
      
      // Проверяем errorCode перед списанием баланса
      const errorCode = betApiResponse?.errorCode || betApiResponse?.d?.BetHeadDetail?.ErrorCode;
      const fullErrorCode = betApiResponse?.fullErrorCode || betApiResponse?.d?.BetHeadDetail?.FullErrorCode;
      
      if (errorCode && errorCode !== 0) {
        this.logger.warn(`BetAPI rejected EXPRESS bet with errorCode: ${errorCode}, fullErrorCode: ${fullErrorCode}`);
        
        let errorMessage = 'Express bet was rejected by BetAPI';
        if (fullErrorCode) {
          errorMessage = `Express bet rejected: ${fullErrorCode}`;
        } else if (errorCode === 1) {
          errorMessage = 'Insufficient funds or bet limit exceeded';
        } else if (errorCode === 2) {
          errorMessage = 'One or more markets are closed or suspended';
        } else if (errorCode === 3) {
          errorMessage = 'One or more coefficients have changed';
        } else if (errorCode === 4) {
          errorMessage = 'One or more events not found or cancelled';
        } else {
          errorMessage = `Express bet rejected with error code: ${errorCode}`;
        }
        
        throw new HttpException({ message: errorMessage }, 400);
      }

      const betCode = betApiResponse?.betCode || betApiResponse?.d?.BetHeadDetail?.BetCode;
      const betApiStatus = betApiResponse?.status || betApiResponse?.d?.BetHeadDetail?.Status || 1;
      const actualCoef = betApiResponse?.d?.BetHeadDetail?.Coef || totalOdds;

      // Списываем баланс
      operationId = await this.prismaService.$transaction(async (prisma) => {
        const operation = await this.operationService.create(
          prisma,
          parseInt(userId),
          {
             type: 'OUTCOME',
             amount: new Decimal(stakeNum),
             currencyCode: currency,
             source: 'BET',
             status: 'SUCCESS',
             meta: {
               description: `Экспресс ставка на ${bets.length} игр`,
               betType: betType || 'EXPRESS',
               betVariant: betVariant || 'EXPRESS',
               betCode: betCode,
               gamesCount: bets.length
             }
           }
        );
        return operation.id;
      });

      // Создаем ExpressBet и связанные Bet записи
      const savedExpressBet = await this.prismaService.$transaction(async (prisma) => {
        // Создаем ExpressBet
        const expressBet = await prisma.expressBet.create({
          data: {
            userId: parseInt(userId),
            amount: stakeNum.toString(),
            cf: actualCoef.toString(),
            currencyCode: currency,
            status: 'PENDING',
            betCode: betCode,
            betApiStatus: betApiStatus,
            betApiResponse: betApiResponse ? JSON.parse(JSON.stringify(betApiResponse)) : null,
          }
        });

        // Создаем отдельные Bet записи для каждой игры
        const createdBets = [];
        for (let i = 0; i < bets.length; i++) {
          const bet = bets[i];
          const betRecord = await prisma.bet.create({
            data: {
              userId: parseInt(userId),
              gameId: bet.eventId,
              betType: betType || 'EXPRESS',
              betVariant: betVariant || 'EXPRESS',
              amount: (stakeNum / bets.length).toString(), // Распределяем сумму между играми
              cf: bet.odds.toString(),
              currencyCode: currency,
              status: 'PENDING',
              expressBetId: expressBet.id,
              betInfo: bet.betInfo || `Express bet game ${i + 1}`,
              ocId: parseInt(bet.outcomeNumber || '0'),
              gameIdExternal: parseInt(bet.eventId),
              subGameId: bet.subGameId ? parseInt(bet.subGameId) : undefined,
              subGameName: bet.subGameName,
              betCode: betCode,
              betApiStatus: betApiStatus,
              betApiResponse: betApiResponse ? JSON.parse(JSON.stringify(betApiResponse)) : null,
            }
          });
          createdBets.push(betRecord);
        }

        return { expressBet, bets: createdBets };
      });

      const potentialPayout = stakeNum * actualCoef;

      return { 
        betId: betCode || savedExpressBet.expressBet.id.toString(), 
        status: 'PENDING', 
        potentialPayout,
        dbBetId: savedExpressBet.expressBet.id,
        coefficientChanged: false,
        originalCoefficient: totalOdds,
        actualCoefficient: actualCoef
      };
    } catch (error: any) {
      let message = 'Failed to place express bet';

      // Rollback операции при ошибке
      if (operationId) {
        try {
          await this.prismaService.$transaction(async (prisma) => {
            await this.operationService.updateStatus(prisma, operationId, OperationStatus.FAILED);
          });
          this.logger.warn(`Rollback operation ${operationId} due to express bet placement error`);
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback operation ${operationId}:`, rollbackError);
        }
      }

      if (axios.isAxiosError(error)) {
        const raw = (error.response?.data as any) ?? {};
        const apiMsg = raw?.message || raw?.error || error.message;
        message = String(apiMsg || 'BetAPI request failed');

        // Нормализуем ключевые сообщения
        if (/exist_bet/i.test(message)) message = 'Один или несколько исходов больше недоступны для ставок';
        else if (/error_repeat_bet_data/i.test(message)) message = 'Нельзя делать ставки из одного матча на разные исходы в экспрессе';
        else if (/error_block_bet_data/i.test(message)) message = 'Одна или несколько ставок временно заблокированы';
        else if (/insufficient/i.test(message)) message = 'Недостаточно средств';
        else if (/market.*closed/i.test(message)) message = 'Один или несколько рынков закрыты';
        else if (/coeff(icient)?/i.test(message) && /chang(ed|e)/i.test(message)) message = 'Один или несколько коэффициентов изменились';
        else if (/game.*not.*found/i.test(message)) message = 'Одна или несколько игр не найдены';
      } else if (error instanceof Error) {
        message = error.message;
      }

      throw new HttpException({ message }, 400);
    }
  }
}
  