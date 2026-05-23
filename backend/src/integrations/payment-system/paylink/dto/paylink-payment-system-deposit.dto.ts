import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PaylinkPaymentSystemDepositDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: '234.10' })
  amount: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'sber' })
  bank?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'RUB' })
  currency: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '24' })
  cvc: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '02' })
  expire_month: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '24' })
  expire_year: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'sbp' })
  extra?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'VLADISLAV MOJ' })
  name?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 1111222233334444 })
  pan: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: '1111222233334444' })
  pan2?: string;
}

export class PaylinkPaymentSystemDepositResponse {
  @ApiProperty({ example: 'https://...' })
  ok: boolean;
}
