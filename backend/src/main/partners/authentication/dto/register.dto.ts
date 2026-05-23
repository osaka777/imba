import { ApiProperty } from '@nestjs/swagger';
import { AffilatorType, Prisma } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PartnerMetaDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  telegram?: string;
}

export class PartnerRegistrationDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ example: 'partner@example.com' })
  email: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PartnerMetaDto)
  @ApiProperty({ 
    example: { 
      phone: '+374 93567119', 
      whatsapp: '+374 93567119', 
      telegram: '+374 93567119' 
    },
    required: false 
  })
  meta?: PartnerMetaDto;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(100)
  @ApiProperty({ example: 'password123' })
  password: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false })
  tag?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'свой сайт' })
  trafficSource: string;

  @IsEnum(AffilatorType)
  @ApiProperty({ enum: AffilatorType, example: 'REVSHARE' })
  type: AffilatorType;
}
