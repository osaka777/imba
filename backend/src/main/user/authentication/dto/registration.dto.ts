import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { AffiliateSubsDto } from '~/main/partners/dto/affiliate-subs.dto';

export class RegistrationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be a valid international number',
  })
  phone: string;

  @IsDateString()
  @IsNotEmpty()
  birthDate: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsString()
  @IsOptional()
  promoCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AffiliateSubsDto)
  subs?: AffiliateSubsDto;
}
