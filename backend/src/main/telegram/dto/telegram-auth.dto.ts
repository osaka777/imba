import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { Dto } from '~/common/types/dto';
import { AffiliateSubsDto } from '~/main/partners/dto/affiliate-subs.dto';

export class TelegramWidgetAuthDto {
  @IsNumber()
  id: number;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsNumber()
  auth_date: number;

  @IsString()
  @IsNotEmpty()
  hash: string;

  @IsIn(['login', 'register'])
  mode: 'login' | 'register';

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AffiliateSubsDto)
  subs?: AffiliateSubsDto;
}

export class TelegramCompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  profileToken: string;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsDateString()
  @IsNotEmpty()
  birthDate: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AffiliateSubsDto)
  subs?: AffiliateSubsDto;
}

export class TelegramAuthResultDto extends Dto<TelegramAuthResultDto> {
  accessToken?: string;

  requiresProfile?: boolean;

  profileToken?: string;

  isNewUser?: boolean;
}
