import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { GameStatus } from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { Dto } from '~/common/types/dto';

export class AvailableGamesDto {
  @IsDateString()
  @IsOptional()
  lastCreatedAt?: Date;

  @Type(() => Number)
  @Max(100)
  @Min(1)
  limit: number;

  @Type(() => Number)
  @Min(0)
  offset: number;
}

export class getGamesByIdsDto {
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ name: 'ids[]' })
  ids: string[];
}

export class FindGameDto {
  @IsString()
  @IsOptional()
  eventName?: string;

  @IsString()
  @IsOptional()
  league?: string;
}

export class ParsedBet {
  @IsOptional()
  @IsString()
  _3w?: string;

  @IsOptional()
  @IsString()
  basis?: 'TOTALS' | 'WIN' | string;

  @IsOptional()
  @IsString()
  dst?: string; // OVER/UNDER удалены - тоталы больше не поддерживаются

  @IsOptional()
  @IsString()
  ot_rt?: string;

  @IsOptional()
  @IsString()
  period_name?: string;

  @IsOptional()
  @IsString()
  period_no?: string;

  @IsOptional()
  @IsString()
  pivot?: string;

  @IsOptional()
  @IsString()
  plr?: '1X' | '12' | 'P1' | 'P2' | 'X2' | string;
}

export class MarketDto extends ParsedBet {
  @IsNumber()
  cf: number;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsBoolean()
  isOpen: boolean;

  @IsString()
  market: string;

  @IsOptional()
  @IsString()
  oc_group_name?: string;
}
export class CreateGameDto {
  @IsString()
  eventId: string;

  @IsString()
  eventName: string;

  @IsString()
  leagueName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketDto)
  markets: MarketDto[];

  @IsOptional()
  meta?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsString()
  score: string;

  @IsString()
  sport: string;

  @IsString()
  status: GameStatus;

  @IsString()
  team1: string;

  @IsString()
  team2: string;
}
export class ParsedScoreDto {
  currentScore: number[];
  details?: number[][];
  liveScore?: {
    active: 0 | 1 | 2;
    score: number[];
  };
  period?: number;
  seconds?: number;
  text: {
    currentScore: string;
    details?: string;
    liveScore?: string;
    time?: string;
  };
}

@ApiExtraModels(MarketDto, ParsedScoreDto)
export class GameDtoWithGroupedMarkets extends Dto<GameDtoWithGroupedMarkets> {
  createdAt: Date;
  eventId: string;
  eventName: string;
  @ApiProperty({
    additionalProperties: {
      items: {
        $ref: getSchemaPath(MarketDto),
      },
      type: 'array',
    },
    type: 'object',
  })
  groupedMarkets?: Record<string, MarketDto[]>;

  leagueName: string;
  meta?: JsonValue;
  parsedScore: ParsedScoreDto;
  priority?: number;
  score: string;
  sport: string;
  @ApiProperty({ enum: Object.values(GameStatus) })
  status: GameStatus;

  team1: string;
  team2: string;
  team1Icon?: string | null;
  team2Icon?: string | null;
  updatedAt: Date;

  @IsOptional()
  @IsNumber()
  betApiStatus?: number;

  @IsOptional()
  betApiBody?: any;

  @ApiProperty({
    description: 'Subcategory information',
    type: 'object',
    properties: {
      id: { type: 'number' },
      code: { type: 'string' },
      name: { type: 'string' },
      sport: { type: 'string' },
      type: { type: 'string', nullable: true },
      isActive: { type: 'boolean' },
      isPriority: { type: 'boolean', nullable: true },
      flag: { type: 'string', nullable: true }
    }
  })
  subcategory?: {
    id: number;
    code: string;
    name: string;
    sport: string;
    type?: string;
    isActive: boolean;
    isPriority?: boolean;
    flag?: string;
  };
}
