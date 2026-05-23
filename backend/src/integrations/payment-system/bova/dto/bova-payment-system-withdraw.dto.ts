import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class BovaPaymentSystemWithdrawDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 100.5 })
  amount: number;

  @IsNumber()
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
  @IsNotEmpty()
  @ApiProperty({ example: '1111222233334444' })
  wallet: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'Ivan Ivanov', required: false })
  recipientName?: string;
}

export class BovaPaymentSystemWithdrawResponseDto {
  id: string;
  result_code: string;
}
