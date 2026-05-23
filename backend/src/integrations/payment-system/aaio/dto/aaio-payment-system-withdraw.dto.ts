import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AaioPaymentSystemWithdrawDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 100.5 })
  amount: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 1, required: false })
  bank?: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'USD' })
  currency: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'cards_ru' })
  method: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'beeline_ru', required: false })
  phone_operator?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '1111222233334444' })
  wallet: string;
}

export class AaioPaymentSystemWithdrawResponseDto {
  id: string;
  type: 'fail' | 'success';
}
