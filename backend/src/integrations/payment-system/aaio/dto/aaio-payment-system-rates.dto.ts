import { Decimal } from '@prisma/client/runtime/library';
import { IsDecimal, IsString } from 'class-validator';

export class AaioPaymentSystemRatesDto {
  @IsDecimal()
  BTC: Decimal;

  @IsDecimal()
  UAH: Decimal;

  @IsDecimal()
  USD: Decimal;

  @IsDecimal()
  USDT: Decimal;

  @IsString()
  type: string;
}
