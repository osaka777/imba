import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PaylinkPaymentSystemWithdrawDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: '234.10' })
  amount: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'bank100000000199' })
  bank?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'RUB' })
  currency: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'sbp' })
  extra?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 1111222233334444 })
  pan: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: '79****' })
  phone?: string;
}

export class PaylinkPaymentSystemWithdrawResponse {
  ok: boolean;
}
