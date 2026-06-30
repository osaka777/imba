import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

import { AffiliateSubsDto } from '~/main/partners/dto/affiliate-subs.dto';

import { Dto } from '~/common/types/dto';

export class CreateUserDto extends Dto<CreateUserDto> {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsNotEmpty()
  password?: string;

  @IsOptional()
  tag?: string;

  @IsOptional()
  promoCode?: string;

  @IsOptional()
  subs?: AffiliateSubsDto;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone: string;

  @IsDateString()
  @IsNotEmpty()
  birthDate: string;
}
