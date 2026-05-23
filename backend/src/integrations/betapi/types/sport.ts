import { BetApiCountriesResponse_ } from '~/integrations/betapi/types/country';
import { BetApiResponse } from '~/integrations/betapi/types/response';

export interface BetApiSport {
  counter: number;
  id: number;
  name: string;
  name_en: string;
  name_ru: string;
  name_ua: string;
}

export interface BetApiSportsResponse_ {
  body: BetApiSport[];
}

export type BetApiSportsResponse = BetApiResponse & BetApiSportsResponse_;
