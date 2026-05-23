import { JsonValue } from '@prisma/client/runtime/library';
import { GameBetApiType, GameStatus } from '@prisma/client';

export type OddsDataType = 'live' | 'prematch';

export interface ChangeDetectionConfig {
  minInterval: number;
  maxInterval: number;
  adaptiveInterval: boolean;
  changeThreshold: number;
  bufferSize: number;
  bufferTTL: number;
}

export interface BetApiChangeDetectorEvent extends BetApiEvent {
  eventId: string;
  sgame_id: string;
  stat_id: string;
  ext_game_id: number;
  game_id: number;
  game_mid: number;
  game_num: number;
  game_dop_name: string;
  game_dop_name_langs: JsonValue;
  game_start: number;
  sport: string;
  type: GameBetApiType;
  status: GameStatus;
}

export interface BetApiEvent {
  // Required fields from GameCreateInput
  eventId: string;
  sgame_id: string;
  stat_id: string;
  ext_game_id: number;
  game_id: number;
  game_mid: number;
  game_num: number;
  game_dop_name: string;
  game_dop_name_langs: JsonValue;
  game_start: number;
  sport: string;
  league_name: string;
  league_name_langs: JsonValue;
  team1_name: string;
  team1_name_langs: JsonValue;
  team2_name: string;
  team2_name_langs: JsonValue;
  score1: number;
  score2: number;
  score_total: string;
  game_comment: string;
  game_comment_langs: JsonValue;
  game_status: number;
  game_period: number;
  game_time: string;
  game_add_time: number;
  game_add_time_last: number;
  game_hash: string;
  game_tv: string;
  game_tv_langs: JsonValue;
  game_timer_type: number;
  game_timer_dir: number;
  game_timer_seconds: number;
  game_timer_seconds_left: number;
  game_timer_updating: number;
  game_favorite: number;
  game_markets_count: number;
  game_markets_count_top: number;
  game_markets_count_main: number;
  game_markets_count_add: number;
  game_markets_count_live: number;
  game_markets_count_line: number;
  game_markets_count_live_main: number;
  game_markets_count_line_main: number;
  game_markets_count_live_top: number;
  game_markets_count_line_top: number;
  stat_list?: any[];
  stat_list_extra?: any;
  events_list?: BetApiEvent[];
  [key: string]: any;
}

export interface BetApiResponse {
  body: BetApiEvent[];
  result?: {
    status: number;
    Status?: number;
  };
  [key: string]: any;
}