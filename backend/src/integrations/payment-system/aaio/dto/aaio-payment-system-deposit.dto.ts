import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AaioPaymentSystemDepositDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 100.5 })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'USD' })
  currency: string;
}

export class AaioPaymentSystemDepositResponse {
  @ApiProperty({ example: 'https://...' })
  link: string;
}
