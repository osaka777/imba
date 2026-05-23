import { BetApiResponse } from '~/integrations/betapi/types/response';

export interface BetApiCountry {
  counter: number;
  id: number;
  name: string;
  name_en: string;
  name_ru: string;
  name_ua?: string;
  sport_id: number;
}

export interface BetApiCountriesResponse_ {
  body: BetApiCountry[];
}

export type BetApiCountriesResponse = BetApiCountriesResponse_ & BetApiResponse;
