import { components } from "~/shared/api";

export type Game = components["schemas"]["GameDtoWithGroupedMarkets"];
export type Games = Game[];

export interface League {
  leagueName: string;
  games: Game[];
}

export interface Subcategory {
  id: number;
  code: string;
  name: string;
  sport: string;
  type?: string;
  isActive: boolean;
  isPriority: boolean;
  flag?: string;
}
