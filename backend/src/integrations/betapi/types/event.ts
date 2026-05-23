import { GameBetApi } from '@prisma/client';

import { BetApiResponse } from '~/integrations/betapi/types/response';

export interface BetApiEventsResponse_ {
  body: {
    events_list: GameBetApi[];
    tournament_id: number;
    tournament_name: string;
  }[];
  page: string;
  status: number;
}

export type BetApiEventsResponse = BetApiEventsResponse_ & BetApiResponse;

export interface EventOcList {
  oc_block: boolean;
  oc_group_name: string;
  oc_name: string;
  oc_pointer: string;
  oc_rate: number;
  oc_size?: number;
}

export type BetApiEventResponse = BetApiResponse<GameBetApi>;
