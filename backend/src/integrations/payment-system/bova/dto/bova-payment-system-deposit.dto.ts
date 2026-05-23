import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class BovaPaymentSystemDepositDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 100.5 })
  amount: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ enum: ['raiffeisen', 'sberbank'] })
  bank?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'USD' })
  currency: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'card' })
  method: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'VLADISLAV MOJ' })
  name: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '1111222233334444' })
  wallet: string;
}

export class BovaPaymentSystemDepositResponse {
  payload: {
    form_url: string;
  };
  result_code: string;
}
