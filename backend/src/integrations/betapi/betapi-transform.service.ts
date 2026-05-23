import { Injectable, Logger } from '@nestjs/common';
import { GameBetApi, GameStatus } from '@prisma/client';
import {
  GameDtoWithGroupedMarkets,
  ParsedScoreDto,
} from '~/main/game/dto/available-games.dto';

@Injectable()
export class BetApiTransformService {
  logger = new Logger('BetApiTransformService');

  constructor() {}

  // --- Спорт Id => Название ---
  static BetApiSportIdToNameData = {
    1: 'soccer',
    2: 'hockey',
    3: 'basketball',
    4: 'tennis',
    6: 'volleyball',
    10: 'table-tennis',
    86: 'esports.cs',
    97: 'esports.dota2',
  };



  static BetApiSportIdToName(id: number): string {
    return this.BetApiSportIdToNameData[id];
  }



  static PrepareOsList(event: GameBetApi) {
    const allBets: any[] = [];
    
    const gameOcList = Array.isArray((event as any).game_oc_list) ? (event as any).game_oc_list : [];
  
    for (const item of gameOcList) {
      if (!item) continue;

      // Check if this is a grouped structure (has oc_list) or flat structure (direct bet)
      if (Array.isArray(item.oc_list)) {
        // Grouped structure - process each bet in the group
        const groupName = item.group_name || 'OTHER';
        const groupId = item.group_id ?? null;
        
        for (const bet of item.oc_list) {
          if (!bet) continue;
          
          const pointerParts = bet.oc_pointer?.split('|') || [];
          allBets.push({
            ...bet,
            group_id: groupId,
            group_name: groupName,
            game_id: pointerParts[0] || '',
            oc_group_id: pointerParts[1] || '',
            oc_sub_group_id: pointerParts[2] || '',
            oc_result: pointerParts[3] !== undefined ? (isNaN(Number(pointerParts[3])) ? pointerParts[3] : Number(pointerParts[3])) : null,
          });
        }
      } else {
        // Flat structure - item is a direct bet
        const groupName = item.oc_group_name || 'OTHER';
        const pointerParts = item.oc_pointer?.split('|') || [];
        
        allBets.push({
          ...item,
          group_id: null,
          group_name: groupName,
          game_id: pointerParts[0] || '',
          oc_group_id: pointerParts[1] || '',
          oc_sub_group_id: pointerParts[2] || '',
          oc_result: pointerParts[3] !== undefined ? (isNaN(Number(pointerParts[3])) ? pointerParts[3] : Number(pointerParts[3])) : null,
        });
      }
    }
  
    return allBets;
  }
  

  // --- Преобразование события в GameDtoWithGroupedMarkets ---
  static eventToGame(event: GameBetApi): GameDtoWithGroupedMarkets {
    // Безопасное получение timer с проверкой на undefined/null
    const timer = event?.timer ?? 0;
    
    const formatSeconds = [
      parseInt(String(timer / 60 / 60)),
      parseInt(String((timer / 60) % 60)),
    ].join(':').replace(/\b(\d)\b/g, '0');

    const score = event.score_full.split(':').map(Number);
    let active: 0 | 1 | 2 = 0;
    active = score[0] > score[1] ? 1 : active;
    active = score[0] < score[1] ? 2 : active;

    const parsedScore: ParsedScoreDto = {
      currentScore: score,
      details: event.score_period.split(';').map(pair => pair.split(':').map(Number)),
      liveScore: { active, score },
      period: Number(event.period_name.replace(/\D/g, '')),
      seconds: timer,
      text: {
        currentScore: event.score_full,
        details: event.score_period.replace(';', ' '),
        liveScore: event.score_full,
        time: timer > 0 ? formatSeconds : '',
      },
    };

    return {
      createdAt: event.createdAt,
      eventId: event.eventId,
      eventName: event.eventName,
      leagueName: event.tournament_name,
      meta: {
        eng_team1: '',
        eng_team2: '',
        raw_start_at: this.formatTimestamp(event.game_start),
        start_at: event.game_start,
        stat_list: event.stat_list || [],
        tv: 1,
        betApiStatus: (event as any).status,
        betApiBody: (event as any).body,
      },
      groupedMarkets: this.ocToGroupedMarkets(event),
      parsedScore,
      priority: event.priority,
      score: this.eventToODDSScoreString(event),
      sport: this.BetApiSportIdToName(event.sport_id),
      status: (event?.timer ?? 0) > 0 ? GameStatus.IN_PROGRESS : GameStatus.STARTING,
      team1: event.opp_1_name,
      team2: event.opp_2_name,
      updatedAt: event.updatedAt,
    } as GameDtoWithGroupedMarkets;
  }

  // --- Преобразование события в input для фронтенда ---
  static eventToGameInput(event: GameBetApi, marketType: string = 'live') {
    // console.log(event);
    const processPlayerIcon = (icon?: string | null) => {
      if (!icon) return '';
      try {
        new URL(icon);
        return icon;
      } catch {
        if (icon.startsWith('//')) return `https:${icon}`;
        if (!icon.startsWith('http')) return `https://${icon}`;
        return '';
      }
    };
    // console.log('event.stat_list', event.stat_list);
    const meta = {
      eng_team1: '',
      eng_team2: '',
      opp_1_icon: processPlayerIcon(event.opp_1_icon),
      opp_2_icon: processPlayerIcon(event.opp_2_icon),
      raw_start_at: this.formatTimestamp(event.game_start),
      start_at: event.game_start,
      stat_list: event.stat_list || [],
      tv: 1,
    };

    const score = this.eventToODDSScoreString(event);

    return {
      eventId: String(event.game_id),
      eventName: `${event.opp_1_name} vs ${event.opp_2_name}`,
      leagueName: event.tournament_name,
      meta,
      groupedMarkets: this.ocToGroupedMarkets(event),
      score,
      sport: this.BetApiSportIdToName(event.sport_id),
      status: marketType === 'live' ? (score ? 'IN_PROGRESS' : 'STARTING') : 'PREMATCH',
      team1: event.opp_1_name,
      team2: event.opp_2_name,
    };
  }

  // --- Форматирование счета ---
  static eventToODDSScoreString(event: GameBetApi): string {
    const time = this.secondsToMMSS(event?.timer ?? 0);
    const cS = event.score_full;
    const dt = ` (${event.score_period.replace(/;/g, ' ').trim()})`;
    const dtWithLive = ` (${event.score_period.replace(/;/g, ' ').trim()} ${event.score_extra})`;
    let live = ` (${event.score_extra.replace(/;/g, ' ').trim()})`;

    switch (this.BetApiSportIdToName(event.sport_id)) {
      case 'basketball':
      case 'esports.dota2':
      case 'esports.lol':
      case 'hockey':
      case 'soccer':
        return `${cS}${dt} ${time}`;
      case 'esports.cs':
      case 'table-tennis':
      case 'volleyball':
        return `${cS}${dtWithLive}`;
      case 'tennis':
        if (Number(event.pitch) === event.opp_1_id)
          live = live.replace(':', '*:');
        if (Number(event.pitch) === event.opp_2_id)
          live = live.replace(')', '*)');
        return `${cS}${dt}${live}`;
      default:
        return `${cS}${dt}`;
    }
  }

  // --- Форматирование timestamp ---
  static formatTimestamp(timestamp: number) {
    const date = new Date(timestamp * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month} ${hours}:${minutes}`;
  }

  // --- Преобразование ставок в сгруппированные рынки ---
  static ocToGroupedMarkets(event: GameBetApi): Record<string, any[]> {
    const allBets = this.PrepareOsList(event);

    if (!allBets || allBets.length === 0) return {};

    const grouped = allBets.reduce((acc, bet: any) => {
      const groupName = bet.group_name || bet.oc_group_name || 'OTHER';
      
      if (!acc[groupName]) acc[groupName] = [];

      // Map BetAPI bet names to frontend expected market keys
      let marketKey = this.mapBetNameToMarketKey(bet.oc_name, bet.oc_group_name, bet.oc_result);

      acc[groupName].push({
        market: marketKey,
        cf: bet.oc_rate || 1,
        isOpen: bet.oc_block !== true && bet.oc_block !== 1, // Ставка заблокирована только если oc_block явно true или 1
        oc_name: bet.oc_name || 'Unknown Bet',
        oc_rate: bet.oc_rate || 1,
        oc_result: bet.oc_result,
        oc_pointer: bet.oc_pointer || '',
        oc_block: Boolean(bet.oc_block), // Явно преобразуем в boolean
        dst: this.determineDst(bet.oc_name, bet.oc_result),
        plr: this.determinePlr(bet.oc_name),
      });

      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  }

  // Map BetAPI bet names to frontend expected market keys
  private static mapBetNameToMarketKey(ocName: string, groupName: string, ocResult: any): string {
    if (!ocName) return 'Unknown Bet';

    const name = ocName.toLowerCase().trim();
    const group = groupName?.toLowerCase();

    // 1X2 Markets
    if (group === '1x2' || group === 'исход' || group === 'основной исход' || group === 'winner') {
      if (name === 'п1' || name === '1' || name.includes('команда 1') || name.includes('team 1')) return 'WIN__P1';
      if (name === 'п2' || name === '2' || name.includes('команда 2') || name.includes('team 2')) return 'WIN__P2';
      if (name === 'ничья' || name === 'x' || name === 'draw') return 'WIN__PX';
    }

    // "Who will win" markets (Кто победит)
    if (group === 'кто победит' || group === 'победитель' || group === 'who will win') {
      // Extract team names and map to P1/P2
      if (name.includes('да') || name.includes('yes')) return 'WIN__P1';
      if (name.includes('нет') || name.includes('no')) return 'WIN__P2';
    }

    // Double Chance Markets
    if (group === 'двойной шанс' || group === 'double chance') {
      if (name === '1x' || name === '1х') return 'WIN__1X';
      if (name === '12') return 'WIN__12';
      if (name === 'x2' || name === '2х') return 'WIN__X2';
    }

    // Handicap Markets
    if (group === 'фора' || group === 'handicap' || group === 'азиатская фора' || group === 'asian handicap') {
      if (ocResult !== null && ocResult !== undefined) {
        if (name.includes('1') || name.startsWith('1') || name.includes('команда 1')) return `HANDICAP__P1_${ocResult}`;
        if (name.includes('2') || name.startsWith('2') || name.includes('команда 2')) return `HANDICAP__P2_${ocResult}`;
      }
    }

    // Total Markets
    if (group === 'тотал' || group === 'total' || group === 'общий тотал' || group === 'total goals') {
      if (ocResult !== null && ocResult !== undefined) {
        if (name.includes('б') || name.includes('больше') || name.includes('over') || name.includes('выше')) {
          return `TOTALS__OVER_${ocResult}`;
        }
        if (name.includes('м') || name.includes('меньше') || name.includes('under') || name.includes('ниже')) {
          return `TOTALS__UNDER_${ocResult}`;
        }
      }
    }

    // Individual Total Markets
    if (group.includes('индивидуальный тотал') || group.includes('individual total') || 
        group.includes('тотал команды') || group.includes('team total')) {
      if (ocResult !== null && ocResult !== undefined) {
        const isTeam1 = group.includes('1-го') || group.includes('команды 1') || group.includes('team 1');
        const isTeam2 = group.includes('2-го') || group.includes('команды 2') || group.includes('team 2');
        const isOver = name.includes('б') || name.includes('больше') || name.includes('over') || name.includes('выше');
        
        let team = 'P1';
        if (isTeam2) team = 'P2';
        else if (!isTeam1 && !isTeam2) {
          // Fallback: try to determine from name
          if (name.includes('2') || name.includes('команда 2')) team = 'P2';
        }
        
        const direction = isOver ? 'OVER' : 'UNDER';
        return `INDIVIDUAL_TOTAL__${team}_${direction}_${ocResult}`;
      }
    }

    // Both Teams to Score
    if (group === 'обе забьют' || group === 'both teams to score' || group === 'обе команды забьют') {
      if (name === 'да' || name === 'yes') return 'BOTH_TEAMS_SCORE__YES';
      if (name === 'нет' || name === 'no') return 'BOTH_TEAMS_SCORE__NO';
    }

    // Correct Score
    if (group === 'точный счет' || group === 'correct score' || group === 'exact score') {
      return `CORRECT_SCORE__${name.replace(/[^0-9:-]/g, '')}`;
    }

    // First Goal / Last Goal
    if (group === 'первый гол' || group === 'first goal') {
      if (name.includes('1') || name.includes('команда 1')) return 'FIRST_GOAL__P1';
      if (name.includes('2') || name.includes('команда 2')) return 'FIRST_GOAL__P2';
      if (name.includes('нет') || name.includes('no goal')) return 'FIRST_GOAL__NO';
    }

    // Half Time / Full Time
    if (group === 'тайм/матч' || group === 'half time/full time' || group === 'ht/ft') {
      return `HT_FT__${name.replace(/[^12x]/gi, '').toUpperCase()}`;
    }

    // Clean Sheets
    if (group === 'сухой матч' || group === 'clean sheet') {
      if (name.includes('1') || name.includes('команда 1')) return 'CLEAN_SHEET__P1';
      if (name.includes('2') || name.includes('команда 2')) return 'CLEAN_SHEET__P2';
      if (name.includes('да') || name === 'yes') return 'CLEAN_SHEET__YES';
      if (name.includes('нет') || name === 'no') return 'CLEAN_SHEET__NO';
    }

    // Corners
    if (group.includes('угловые') || group.includes('corners')) {
      if (group.includes('тотал') || group.includes('total')) {
        if (name.includes('б') || name.includes('больше') || name.includes('over')) {
          return `CORNERS_TOTAL__OVER_${ocResult}`;
        }
        if (name.includes('м') || name.includes('меньше') || name.includes('under')) {
          return `CORNERS_TOTAL__UNDER_${ocResult}`;
        }
      }
      if (group.includes('фора') || group.includes('handicap')) {
        if (name.includes('1')) return `CORNERS_HANDICAP__P1_${ocResult}`;
        if (name.includes('2')) return `CORNERS_HANDICAP__P2_${ocResult}`;
      }
    }

    // Cards
    if (group.includes('карточки') || group.includes('cards')) {
      if (group.includes('тотал') || group.includes('total')) {
        if (name.includes('б') || name.includes('больше') || name.includes('over')) {
          return `CARDS_TOTAL__OVER_${ocResult}`;
        }
        if (name.includes('м') || name.includes('меньше') || name.includes('under')) {
          return `CARDS_TOTAL__UNDER_${ocResult}`;
        }
      }
    }

    // Fallback: use original name with result if available
    if (ocResult !== null && ocResult !== undefined && ocResult !== 0 && ocResult !== '0') {
      return `${ocName}_${ocResult}`;
    }

    return ocName;
  }

  private static determineDst(ocName: string, ocResult: any): string | undefined {
    if (!ocName) return undefined;
    const name = ocName.toLowerCase();
    if (name.includes('больше') || name.includes('over')) return 'OVER';
    if (name.includes('меньше') || name.includes('under')) return 'UNDER';
    return undefined;
  }

  private static determinePlr(ocName: string): string | undefined {
    if (!ocName) return undefined;
    const name = ocName.toLowerCase();
    if (name.includes('п1') || name === '1') return 'P1';
    if (name.includes('п2') || name === '2') return 'P2';
    if (name.includes('x') || name.includes('ничья')) return 'PX';
    return undefined;
  }

  static secondsToMMSS(seconds: number): string {
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
