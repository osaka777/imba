export interface components {
  schemas: {
    MarketDto: {
      cf: number;
      market: string;
      dst?: string; // OVER/UNDER для тоталов
      pivot?: string | number;
      oc_block?: boolean | number | string;
      blocked?: boolean;
      available?: boolean;
      plr?: string;
      period_no?: number;
      period_name?: string;
      display_name?: string;
      isOpen?: boolean;
      oc_group_name?: string;
      oc_name?: string;
    };
    RateDto: {
      coef?: string;
      eventId?: string;
      eventName?: string;
      market?: string;
      groupedMarket?: any;
      isOpen?: boolean;
      isAvailable?: boolean;
      oc_block?: any;
      blocked?: any;
      available?: any;
      sum?: string;
    };
    CreateBetDto: {
      eventId?: string;
      marketId?: string;
      outcomeId?: string;
      odds?: number;
      stake: number;
      currency?: string;
      betType: 'ORDINAR' | 'EXPRESS';
      betVariant: 'ORDINAR' | 'EXPRESS';
      betInfo?: string;
      // Для экспресс ставок
      bets?: {
        eventId: string;
        marketId: string;
        outcomeId: string;
        odds: number;
        betInfo?: string;
        groupNumber?: string;
        outcomeNumber?: string;
        numericOutcome?: number | string;
        isLive?: boolean;
        subGameId?: string;
        subGameName?: string;
      }[];
      // Дополнительные поля для обычных ставок
      groupNumber?: string;
      outcomeNumber?: string;
      numericOutcome?: number | string;
      isLive?: boolean;
      subGameId?: string;
      subGameName?: string;
    };
    BetDto: {
      id: number;
      userId: number;
      gameId: string;
      betType: string;
      betVariant: string;
      amount: string;
      cf: string;
      currencyCode: string;
      status: string;
      expressBetId?: number;
      createdAt: string;
      updatedAt: string;
      game?: any;
      betInfo?: any;
      subGameId?: string;
      subGameName?: string;
      parentEventId?: string;
    };
    ExpressBetDto: {
      id: number;
      userId: number;
      amount: string;
      cf: string;
      currencyCode: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      bets: components['schemas']['BetDto'][];
      game?: any;
    };
    GameDtoWithGroupedMarkets: {
      eventId: string;
      eventName: string;
      team1: string;
      team2: string;
      team1Icon?: string | null;
      team2Icon?: string | null;
      sport: string;
      leagueName: string;
      status?: string;
      groupedMarkets?: {
        [key: string]: components['schemas']['MarketDto'][];
      };
      parsedScore?: {
        text: {
          currentScore?: string;
          details?: string;
          liveScore?: string;
          time?: string;
        };
        liveScore?: {
          active?: number;
        };
      };
      meta?: {
        raw_start_at?: string;
        betApiStatus?: number;
        betApiBody?: any[];
      };
      priority?: number;
      sub_games?: components['schemas']['SubGameDto'][];
    };
    SubGameDto: {
      game_id: number;
      game_num: number;
      game_name: string;
    };
  };
}