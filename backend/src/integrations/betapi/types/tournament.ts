import { BetApiResponse } from '~/integrations/betapi/types/response';

export interface BetApiTournament {
  counter: number;
  country_id: number;
  id: number;
  name: string;
  name_en: string;
  name_ru: string;
  name_ua?: string;
  sport_id: number;
}

export interface BetApiTournamentResponse_ {
  body: BetApiTournament[];
}

export type BetApiTournamentResponse = BetApiResponse &
  BetApiTournamentResponse_;
