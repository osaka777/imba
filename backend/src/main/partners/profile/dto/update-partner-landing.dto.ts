import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdatePartnerLandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsIn(['HERO_MATCH', 'EVENTS_GRID', 'PROMO_FOCUS'])
  template?: 'HERO_MATCH' | 'EVENTS_GRID' | 'PROMO_FOCUS';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subheadline?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,32}$/)
  promoCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  eventRefs?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  defaultSub1?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
